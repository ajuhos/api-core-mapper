import {
    Api,
    ApiEdgeDefinition,
    ApiEdgeMethod,
    ApiEdgeMethodScope,
    ApiEdgeRelation,
    ApiEdgeSchema,
    ApiRequestType,
    JSONDate,
    Mixed,
    OneToOneRelation,
    SchemaReference,
    SubSchema
} from "api-core";
import * as fs from 'fs';
import {SecurityProvider} from "./SecurityProvider";
import { titleCase } from "title-case";

const ValidTypeNames = ['array', 'boolean', 'integer', 'number', 'object', 'string'];
const URL = require('url');
const {parse: parseJSDocType, publish: publishJSDocType} = require('jsdoctypeparser');
const Articles = require('articles');

export function normaliseName(name: string) {
    return titleCase(name.replace(/-/g, ' '))
}

interface Param {
    name: string
    type: string
    kind: 'body'|'query'
    optional: boolean
    defaultValue?: string
    summary: string
}

interface ResponseParam {
    name?: string
    optional: boolean
    type: string
    summary: string
}

interface ResponseCode {
    code: string
    summary: string
}

interface Comment {
    summary: string,
    description: string,
    remarks: string,
    returns: string,
    examples: string[],
    params: Param[]
    response: ResponseParam[]
    responseCodes: ResponseCode[]
}

export class ApiSwaggerMapper {

    levelLimit: number = 2;
    extendedTags: boolean = true;
    documentation: {
        [key: string]: {
            entries: {
                [key: string]: {
                    verbs: {
                        [key: string]: {
                            comment: Comment
                        }
                    },
                    comment: Comment
                }
            }
        }
    } = {};
    schemaDocumentation: {
        [key: string]: {
            description: string,
            modifiers: string[],
            fields: {
                [key: string]: {
                    description: string
                }
            }
        }
    } = {};
    private api: Api;
    private securityProvider?: SecurityProvider;

    constructor(api: Api, securityProvider?: SecurityProvider) {
        this.api = api;
        this.securityProvider = securityProvider;
        try {
            const docs = JSON.parse(fs.readFileSync('./api-core-docs.json', {encoding: 'utf8'}));
            if(docs['.apidocs']) {
                this.documentation = docs.edges;
                this.schemaDocumentation = docs.schemas
            }
            else {
                this.documentation = docs;
                this.schemaDocumentation = {}
            }
        }
        catch {}
    }

    private static acceptedTypesToListOfOperationModes(types: ApiRequestType) {
        const output = [];
        if(types & ApiRequestType.Create) output.push('put');
        if(types & ApiRequestType.Read) output.push('get');
        if(types & ApiRequestType.Update) output.push('post');
        if(types & ApiRequestType.Patch) output.push('patch');
        if(types & ApiRequestType.Delete) output.push('delete');
        //TODO: Exists
        return output
    }

    private static provideRef(referenceName: string, version: number) {
        if(version === 2) {
            return `#/definitions/${referenceName}`
        }
        else {
            return `#/components/schemas/${referenceName}`

        }
    }

    private provideOperation(target: any,
                             path: string,
                             tag: string,
                             name: string,
                             description: string,
                             parameterName: string,
                             referenceName: string,
                             security: any,
                             { name: edgeName, pluralName, schema: { fields, originalSchema }, relations }: ApiEdgeDefinition,
                             version: number) {
        const parameters = [];

        if(parameterName) {
            parameters.push(ApiSwaggerMapper.provideIdParam(parameterName, version))
        }

        const docsEntry = this.documentation[edgeName]?.entries[path] || {};
        const docs = (docsEntry?.verbs || {})[name]?.comment || docsEntry?.comment;
        const publicEdgeName = normaliseName(edgeName);

        target[name] = {
            summary: description,
            description: docs ? docs.description : description,
            tags: [ tag ],
            parameters,
            responses: this.generateResponseCodes(docs, version, `The requested ${publicEdgeName}`),
            security
        };

        let schema: any = {
            "$ref": ApiSwaggerMapper.provideRef(edgeName, version)
        }

        if(name == "get" && !parameterName) {
            schema = {
                type: "array",
                items: schema
            }

            ApiSwaggerMapper.generateSortParam(parameters, fields, version);
            ApiSwaggerMapper.generatePaginationParams(parameters, version);
            this.generateWhereParam(parameters, fields, originalSchema, version);
        }

        if(version === 2) {
            target[name] = {
                ...target[name],
                consumes: [
                    "application/json"
                ],
                produces: [
                    "application/json"
                ]
            }

            if(referenceName) {
                parameters.push({
                    "in": "body",
                    name: "body",
                    description: `The input ${publicEdgeName} object`,
                    required: true,
                    schema
                })
            }

            target[name].responses["200"].schema = schema
        }
        else {
            const content = target[name].responses["200"].content = {
                "application/json": {
                    schema
                }
            }

            if(referenceName) {
                target[name].requestBody = {
                    required: true,
                    description: `The input ${publicEdgeName} object`,
                    content
                }
            }
        }

        if(name == "get") {
            ApiSwaggerMapper.generateEmbedParam(parameters, edgeName, pluralName, relations, version);
            ApiSwaggerMapper.generateFieldsParam(parameters, fields, version);
        }

        if(name == "post") {
            if(docs?.responseCodes?.length) {
                target[name].responses["201"] = {
                    description: "Created"
                }
            }
            else {
                target[name].responses = {
                    "201": {
                        description: "Created"
                    }
                }
            }
        }
        else if(parameterName) {
            target[name].responses["404"] = {
                description: "Not Found"
            }
        }
    }

    private static generateSortParam(parameters: any[], fields: string[], version: number) {
        parameters.push(ApiSwaggerMapper.provideQueryParam(
            "sort",
            "Sort the response entries by a specified field in the given direction. Direction can be specified using either a plus or a minus sign before the field name.",
            {
                type: "string",
                pattern: `^[+-]?(${fields.join('|')})$`
            },
            version
        ))
    }

    private static generatePaginationParams(parameters: any[], version: number) {
        parameters.push(ApiSwaggerMapper.provideQueryParam(
            "limit",
            "If specified, it determines the maximum number of entries to return.",
            {
                type: "integer",
                minimum: 1
            },
            version
        ))

        parameters.push(ApiSwaggerMapper.provideQueryParam(
            "skip",
            "If specified, it determines how many entries to skip before the first entry to return. This and `limit` combined can be used for pagination.",
            {
                type: "integer",
                minimum: 0
            },
            version
        ))

        parameters.push(ApiSwaggerMapper.provideQueryParam(
            "page",
            "If specified, it determines the index of the page of entries to return. Page size is specified by the `limit` parameter.",
            {
                type: "integer",
                minimum: 1
            },
            version
        ))
    }

    private generateWhereParam(parameters: any[], fields: string[], originalSchema: any, version: number) {
        const properties: any = {};
        for (let field of fields) {
            const schemaEntry = originalSchema[field];
            if (schemaEntry) {
                const typeString = this.mapSchemaFieldType(schemaEntry.type);
                if(typeString) {
                    const type = typeof typeString === 'string' ? {type: typeString} : typeString;
                    const innerProperties: any = {};
                    if (typeString === 'number' || (type.format === 'date')) {
                        innerProperties['gt'] = {...type, description: 'Greater than the provided value.'}
                        innerProperties['gte'] = {
                            ...type,
                            description: 'Greater than or equals with the provided value.'
                        }
                        innerProperties['lt'] = {...type, description: 'Lower than the provided value.'}
                        innerProperties['lte'] = {...type, description: 'Lower than or equals with the provided value.'}
                    }
                    else if (typeString === 'string') {
                        innerProperties['like'] = {...type, description: 'Similar to the provided value.'}
                    }

                    properties[field] = {
                        type: 'object',
                        properties: {
                            eq: {...type, description: 'Equals with the provided value.'},
                            ne: {...type, description: 'Not equals with the provided value.'},
                            in: {
                                type: "string",
                                description: 'Comma separated list of values in which the target should be present.'
                            },
                            ...innerProperties
                        }
                    }
                }
            }
        }

        parameters.push({
            ...ApiSwaggerMapper.provideQueryParam(
                "where",
                "Filters the returned entries based on advanced criteria.",
                {
                    type: "object",
                    properties
                },
                version
            ),
            style: 'deepObject',
            explode: true
        })
    }

    private static generateFieldsParam(parameters: (any | { schema: any; in: string; name: string; description: string; required: boolean })[], fields: string[], version: number) {
        parameters.push({
            ...ApiSwaggerMapper.provideQueryParam(
                "fields",
                "If specified, the response entries will only contain the listed fields. Comma separated list.",
                {
                    type: "array",
                    items: {
                        type: "string",
                        enum: fields
                    }
                },
                version
            ),
            style: 'form',
            explode: false
        })
    }

    private static generateEmbedParam(parameters: (any | { schema: any; in: string; name: string; description: string; required: boolean })[], edgeName: string, edgePluralName: string, relations: ApiEdgeRelation[], version: number) {
        const fields = relations.filter(r => r.name !== edgeName && r.name !== edgePluralName).map(r => r.name);
        parameters.push({
            ...ApiSwaggerMapper.provideQueryParam(
                "embed",
                "Populates the specified related fields in the response entries. Comma separated list.",
                {
                    type: "array",
                    items: {
                        type: "string",
                        enum: [ ...new Set(fields) ]
                    }
                },
                version
            ),
            style: 'form',
            explode: false
        })
    }

    private providePath(target: any,
                        tag: string,
                        path: string,
                        operations: { name: string, description: string, parameter: string, ref?: string, security?: any }[],
                        edge: ApiEdgeDefinition, version: number, idParam = "") {
        target[path] = {};

        if(idParam) {
            target[path].parameters =[
                ApiSwaggerMapper.provideIdParam(idParam, version)
            ]
        }

        operations.forEach(operation => {
            this.provideOperation(target[path], path, tag,
                operation.name, operation.description, operation.parameter, operation.ref || '', operation.security, edge, version)
        })
    }

    private async generateAllOperations(path: string, { name, pluralName, allowCreate, allowGet, allowList, allowPatch, allowRemove, allowUpdate }: ApiEdgeDefinition, version: number, idParam: string = "") {
        const extra = idParam ? " by ID" : "";
        const publicEdgeName = Articles.articlize(normaliseName(name));
        const publicPluralName = normaliseName(pluralName);

        let security: any = {};
        if(version === 3 && this.securityProvider) {
            security = await this.securityProvider.securityForRoute(path, [ 'get', 'put', 'patch', 'delete', 'post' ])
        }

        let output: any = [];

        if((allowGet && idParam) || (allowList && !idParam)) {
            output.push({ name: "get", description: idParam ? `Get ${publicEdgeName}` : `List ${publicPluralName}`, security: security.get, parameter: idParam })
        }

        if(allowPatch) {
            //TODO: Better typing for body: nothing is required here
            output.push({ name: "patch", description: `Modify ${publicEdgeName}` + extra, parameter: idParam, security: security.patch, ref: name })
        }

        if(allowUpdate) {
            output.push({ name: "put", description: `Replace ${publicEdgeName}` + extra, parameter: idParam, security: security.put, ref: name })
        }

        if(allowRemove) {
            output.push({ name: "delete", description: `Delete ${publicEdgeName}` + extra, security: security.delete, parameter: idParam })
        }

        if(!idParam && allowCreate) {
            output.push({ name: "post", description: `Create ${publicEdgeName}`, parameter: idParam, security: security.post, ref: name });
        }
        return output
    }

    private generateMethodParameters(docs: { params: Param[], apiCoreQueryParams?: string[] }, { name: edgeName, pluralName, schema: { fields, originalSchema}, relations }: ApiEdgeDefinition, version: number) {
        const { params, apiCoreQueryParams } = docs;
        const requiredPropertyNames: string[] = [];
        const schemaProperties: any = {};
        const body: any = {
            "in": "body",
            name: "body",
            required: true,
            schema: {
                "type": "object",
                "required": requiredPropertyNames,
                "properties": schemaProperties
            }
        };

        const output = [];

        let hasBody = false;
        for(let param of params) {
            if(param.kind === 'body') {
                hasBody = true;
                if(!param.optional) requiredPropertyNames.push(param.name);
                schemaProperties[param.name] = {
                    ...this.resolveType(param.type, version),
                    description: param.summary
                }
                if(param.defaultValue) {
                    schemaProperties[param.name].default = this.resolveValue(param.defaultValue)
                }
            }
            else {
                let entry: any = {
                    name: param.name,
                    description: param.summary,
                    "in": "query",
                    required: !param.optional,
                    ...this.resolveType(param.type, version),
                }
                if(param.defaultValue) {
                    entry.default = this.resolveValue(param.defaultValue)
                }
                output.push(entry)
            }
        }

        if(apiCoreQueryParams) {
            const allParams = apiCoreQueryParams.indexOf('all') !== -1;
            if(allParams || apiCoreQueryParams.indexOf('pagination') !== -1) {
                ApiSwaggerMapper.generatePaginationParams(output, version)
            }
            if(allParams || apiCoreQueryParams.indexOf('embed') !== -1) {
                ApiSwaggerMapper.generateEmbedParam(output, edgeName, pluralName, relations, version)
            }
            if(allParams || apiCoreQueryParams.indexOf('fields') !== -1) {
                ApiSwaggerMapper.generateFieldsParam(output, fields, version)
            }
            if(allParams || apiCoreQueryParams.indexOf('sort') !== -1) {
                ApiSwaggerMapper.generateSortParam(output, fields, version)
            }
            if(allParams || apiCoreQueryParams.indexOf('where') !== -1) {
                this.generateWhereParam(output, fields, originalSchema, version)
            }
        }

        if(hasBody) {
            if(!requiredPropertyNames.length) delete body.schema.required
        }

        if(version === 2 || !hasBody) {
            if(hasBody) output.push(body);
            return {
                parameters: output
            }
        }
        else {
            return {
                parameters: output,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: body.schema
                        }
                    }
                }
            }
        }
    }

    private resolveTypeName(name: string, version: number) {
        const lowerCaseName = name.toLowerCase();
        if(ValidTypeNames.indexOf(lowerCaseName) !== -1) {
            return {
                type: lowerCaseName
            }
        }
        else if(lowerCaseName === 'true' || lowerCaseName === 'false') {
            return {
                type: 'boolean',
                enum: [ lowerCaseName ]
            }
        }
        else if(lowerCaseName === "objectid" || lowerCaseName === "object-id") {
            return {
                type: 'string',
                format: "ObjectId",
                pattern: "^[A-Fa-f\\d]{24}$"
            }
        }
        else {
            const edge = this.api.edges.filter(e => e.schema).find(e => e.name.toLowerCase() === lowerCaseName);
            if(edge) {
                return { $ref: ApiSwaggerMapper.provideRef(edge.name, version) }
            }
            else {
                return {
                    type: "object",
                    format: name
                }
            }
        }
    }
    private static resolveValueName(name: string) {
        if(name === 'true') return true;
        else if(name === 'false') return false;
        else if(name === 'null') return null;
        else if(name === 'undefined') return undefined;
        else if(name === 'NaN') return NaN;
        else if(name === 'Infinity') return Infinity;
        else return name
    }

    private static traverseTypeUnion(level: any): any[] {
        let output: any[] = level.left.type === "UNION"
            ? ApiSwaggerMapper.traverseTypeUnion(level.left)
            : [ level.left ];
        if(level.right.type === "UNION") output.push(...this.traverseTypeUnion(level.right));
        else output.push(level.right);
        return output
    }

    private resolveTypeASTLevel(level: any, version: number): any {
        switch(level.type) {
            case "NAME":
                return this.resolveTypeName(level.name, version);

            case "UNION":
                const oneOf = ApiSwaggerMapper.traverseTypeUnion(level);
                if(oneOf.every(e => e.type === "STRING_VALUE")) {
                    return {
                        type: "string",
                        enum: oneOf.map(e => e.string)
                    }
                }
                else if(oneOf.every(e => e.type === "NUMBER_VALUE")) {
                    return {
                        type: "number",
                        enum: oneOf.map(e => +e.number)
                    }
                }
                else if(version === 3) {
                    return {
                        oneOf: oneOf.map(e => this.resolveTypeASTLevel(e, version))
                    }
                }
                else {
                    return {
                        type: "object",
                        format: publishJSDocType(level)
                    }
                }

            case "RECORD":
                const requiredPropertyNames: string[] = [];
                const schemaProperties: any = {};
                let schema: any = {
                    type: "object",
                    "required": requiredPropertyNames,
                    "properties": schemaProperties
                }
                for(let entry of level.entries) {
                    requiredPropertyNames.push(entry.key);
                    schemaProperties[entry.key] = entry.value
                        ? this.resolveTypeASTLevel(entry.value, version)
                        : { type: 'string' }; //TODO: Better default
                }
                if(!requiredPropertyNames.length) delete schema.required;
                return schema;

            case "GENERIC":
                if(level.subject.type === "NAME" && level.subject.name === "Array") {
                    return {
                        type: "array",
                        items: this.resolveTypeASTLevel(level.objects[0], version)
                    }
                }
                else {
                    return {
                        type: "object",
                        format: publishJSDocType(level)
                    }
                }

            case "STRING_VALUE":
                return {
                    type: "string",
                    enum: [ level.string ]
                }

            case "NUMBER_VALUE":
                return {
                    type: "number",
                    enum: [ +level.number ]
                }

            default:
                return {
                    type: "object",
                    format: publishJSDocType(level)
                }
        }
    }

    private resolveValueASTLevel(level: any): any {
        switch(level.type) {
            case "NAME":
                return ApiSwaggerMapper.resolveValueName(level.name);

            case "RECORD":
                const record: any = {}
                for(let entry of level.entries) {
                    if(entry.value) {
                        record[entry.key] = this.resolveValueASTLevel(entry.value)
                    }
                }
                return record;

            case "GENERIC":
                if(level.subject.type === "NAME" && level.subject.name === "Array") {
                    return level.objects.map((obj: any) => this.resolveValueASTLevel(obj))
                }
                else {
                    return publishJSDocType(level)
                }

            case "STRING_VALUE":
                return level.string

            case "NUMBER_VALUE":
                return +level.number

            default:
                return publishJSDocType(level)
        }
    }

    private resolveType(name: string, version: number) {
        try {
            const AST = parseJSDocType(name);
            return this.resolveTypeASTLevel(AST, version)
        }
        catch(e) {
            return {
                type: "INVALID",
                error: e.message,
                format: name
            }
        }
    }

    private resolveValue(name: string) {
        try {
            const AST = parseJSDocType(name);
            return this.resolveValueASTLevel(AST)
        }
        catch(e) {
            return name
        }
    }

    private generateResponseCodes(docs: Comment, version: number, description200: string = "OK") {
        const output: any = {};
        let code20x: any = null;
        if(docs) {
            for (let {code, summary: description} of docs.responseCodes) {
                output[code] = {description};
                if (code.startsWith("20")) {
                    code20x = output[code]
                }
            }
        }

        if(!code20x) {
            output["200"] = code20x = { description: description200 }
        }

        if(docs?.response) {
            if (docs.response.length > 1 || (docs.response.length && docs.response[0].name)) {
                const requiredPropertyNames: string[] = [];
                const schemaProperties: any = {};
                code20x.schema = {
                    "type": "object",
                    "required": requiredPropertyNames,
                    "properties": schemaProperties
                }
                for (let param of docs.response) {
                    if (param.name) {
                        if (!param.optional) requiredPropertyNames.push(param.name);
                        schemaProperties[param.name] = {
                            ...this.resolveType(param.type, version),
                            description: param.summary
                        }
                    }
                }
                if (!requiredPropertyNames.length) delete code20x.schema.required;
            }
            else if (docs.response.length === 1) {
                code20x.schema = this.resolveType(docs.response[0].type, version)
            }
        }

        return output
    }

    private static provideIdParam(idParam: string, version: number) {
        const output: any = {
            "in": "path",
            "name": idParam,
            "required": true
        };

        if(version === 2) {
            output.type = "string";
            output.format = "ObjectId";
            output.patern =  "^[A-Fa-f\\d]{24}$"
        }
        else {
            output.schema = {
                type: "string",
                format: "ObjectId",
                pattern: "^[A-Fa-f\\d]{24}$"
            }
        }

        return output
    }

    private static provideQueryParam(name: string, description: string, schema: any, version: number, required?: boolean) {
        let output: any = {
            "in": "query",
            name,
            description,
            required
        };

        if(version === 2) {
            output = {
                ...output,
                ...schema
            }
        }
        else {
            output.schema = schema
        }

        return output
    }

    private provideMethodDocs(docs: any, tag: string, method: ApiEdgeMethod, edge: ApiEdgeDefinition, version: number) {
        const publicName = normaliseName(method.name);
        let data: any = {
            summary: docs.summary || `Call ${publicName}`,
            description: docs.description,
            tags: [ tag ],
            ...this.generateMethodParameters(docs, edge, version),
            responses: this.generateResponseCodes(docs, version, 'OK')
        };

        if(docs.modifiers && docs.modifiers.indexOf("deprecated") !== -1) {
            data.deprecated = true
        }

        if(version === 2) {
            data = {
                ...data,
                consumes: [
                    "application/json"
                ],
                produces: [
                    "application/json"
                ]
            }
        }
        else {
            for(let key in data.responses) {
                if(data.responses.hasOwnProperty(key)) {
                    const value = data.responses[key];
                    if (value.schema) {
                        data.responses[key] = {
                            description: value.description,
                            content: {
                                "application/json": {
                                    schema: value.schema
                                }
                            }
                        }
                    }
                }
            }
        }

        return data
    }


    private async provideMethod(target: any, tag: string, prefix = "", method: ApiEdgeMethod, edge: ApiEdgeDefinition, version: number, idParam?: string) {
        const modes: any[] = ApiSwaggerMapper.acceptedTypesToListOfOperationModes(method.acceptedTypes);
        const route = `${prefix}/${method.name}`;
        const path: any = target[route] = {};

        if(idParam) {
            path.parameters =[
                ApiSwaggerMapper.provideIdParam(idParam, version)
            ]
        }

        const methodDocs = this.documentation[edge.name]?.entries[method.name];
        const docs = methodDocs?.comment || {
            params: [], examples: [], responseCodes: [], response: []
        };
        let data = this.provideMethodDocs(docs, tag, method, edge, version);

        let security: any = {};
        if(version > 2 && this.securityProvider) {
            security = await this.securityProvider.securityForRoute(route, modes)
        }

        for(let mode of modes) {
            const alternateDocs = (methodDocs?.verbs || {})[mode]?.comment;
            const innerData = alternateDocs ? this.provideMethodDocs(alternateDocs, tag, method, edge, version) : data;

            path[mode] = {
                ...innerData,
                security: security[mode]
            }
        }
    }

    private provideRoutesSingular = async (target: any, tag: string, edge: ApiEdgeDefinition, version: number, prefix = "", level = 1, idParam = "") => {
        if(level > this.levelLimit) return [];

        this.providePath(target, tag, prefix, await this.generateAllOperations(prefix, edge, version), edge, version, idParam);

        edge.methods.forEach(
            (method: ApiEdgeMethod) => {
                if(method.scope == ApiEdgeMethodScope.Entry || method.scope == ApiEdgeMethodScope.Edge) {
                    this.provideMethod(target, tag, prefix, method, edge, version, idParam)
                }
            });

        const filtered = edge.relations
            .filter((relation: ApiEdgeRelation) => relation.from == edge && !relation.external);
        for(let relation of filtered) {
            if(relation instanceof OneToOneRelation) {
                await this.provideRoutesSingular(target,
                    this.extendedTags ? `${tag}/${relation.name}` : tag,
                    relation.to, version,
                    `${prefix}/${relation.name}`,
                    level + 1, idParam)
            }
            else {
                await this.provideRoutes(target,
                    this.extendedTags ? `${tag}/${relation.name}` : tag,
                    relation.to, version,
                    `${prefix}/${relation.name}`,
                    level + 1, idParam)
            }
        }
    };

    private provideRoutes = async (target: any, tag: string, edge: ApiEdgeDefinition, version: number, prefix = "", level = 1, idParam = "") => {
        if(level > this.levelLimit) return [];

        this.providePath(target, tag, prefix, await this.generateAllOperations(prefix, edge, version), edge, version, idParam);
        this.providePath(target, tag,
            `${prefix}/{${edge.idField}}`, await this.generateAllOperations(`${prefix}/{${edge.idField}}`, edge, version, edge.idField), edge, version, idParam);

        edge.methods.forEach(
            (method: ApiEdgeMethod) => {
                if(method.scope == ApiEdgeMethodScope.Collection || method.scope == ApiEdgeMethodScope.Edge) {
                    this.provideMethod(target, tag, prefix, method, edge, version, idParam)
                }

                if(method.scope == ApiEdgeMethodScope.Entry || method.scope == ApiEdgeMethodScope.Edge) {
                    this.provideMethod(target, tag, `${prefix}/{${edge.idField}}`, method, edge, version, edge.idField || idParam) //TODO: Handle multiple id params
                }
            });

        const filtered = edge.relations
            .filter((relation: ApiEdgeRelation) => relation.from == edge && !relation.external)
        for(let relation of filtered) {
            if(relation instanceof OneToOneRelation) {
                await this.provideRoutesSingular(target,
                    this.extendedTags ? `${tag}/${relation.name}` : tag,
                    relation.to, version,
                    `${prefix}/{${edge.idField}}/${relation.name}`,
                    level + 1, edge.idField || idParam) //TODO: Handle multiple id params
            }
            else {
                await this.provideRoutes(target,
                    this.extendedTags ? `${tag}/${relation.name}` : tag,
                    relation.to, version,
                    `${prefix}/{${edge.idField}}/${relation.name}`,
                    level + 1, edge.idField || idParam) //TODO: Handle multiple id params
            }
        }
    };

    private mapEdge = (target: any, edge: ApiEdgeDefinition, version: number) => {
        const tag = normaliseName(edge.pluralName)
        return this.provideRoutes(target, tag, edge, version, `/${edge.pluralName}`)
    };

    /*    private mapDefinition = (edge: ApiEdgeDefinition) => {
            //TODO
        };*/

    private mapEdges = async (version: number) => {
        let output: any = {};
        const filtered = this.api.edges.filter(edge => !edge.external);
        for(let edge of filtered) {
            await this.mapEdge(output, edge, version)
        }
        return output
    };

    private mapSchemaFieldType(type: any): any {
        switch(type) {
            case Number:
                return 'number';
            case String:
                return 'string';
            case JSONDate:
                return { type: 'string', format: 'date' };
            case SchemaReference:
                return { type: 'string', format: 'ObjectId', pattern: "^[A-Fa-f\\d]{24}$" };
            case Boolean:
                return 'boolean';
            case Mixed:
            case Object:
                return 'object';
            default:
                if(Array.isArray(type)) {
                    return this.mapArrayField(type)
                }
                else if(type && typeof type == "object") {
                    return this.mapObjectField(type)
                }
        }
    }

    private mapSchemaField(field: any) {
        if(Array.isArray(field)) {
            return this.mapSchemaFieldType(field)
        }
        else if(typeof field == "object") {
            if(field.type) {
                if(typeof field.type === "object") {
                    return this.mapSchemaFieldType(field.type)
                }
                else {
                    return {
                        type: this.mapSchemaFieldType(field.type)
                    }
                }
            }
            else if(field instanceof SubSchema) {
                return this.mapObjectField(field.original)
            }
            else {
                return this.mapSchemaFieldType(field)
            }
        }
        else {
            return {
                type: this.mapSchemaFieldType(field)
            }
        }
    }

    private mapObjectField(field: any, schemaName?: string) {
        const keys = Object.keys(field);
        const docs = schemaName ? this.schemaDocumentation[schemaName] : null;

        const properties: { [key: string]: any } = {};
        keys.forEach(key => properties[key] = this.mapSchemaField(field[key]));

        const output: any = {
            type: 'object',
            properties
        }

        if(docs) {
            output.description = docs.description;
            if(docs.modifiers && docs.modifiers.indexOf("deprecated") !== -1) {
                output.deprecated = true
            }
            for(let fieldName in docs.fields) {
                if(docs.fields.hasOwnProperty(fieldName) && properties.hasOwnProperty(fieldName)) {
                    properties[fieldName].description = docs.fields[fieldName].description
                }
            }
        }

        const required = keys.filter(key => field[key].required);
        if(required.length) {
            output.required = required
        }

        return output
    }

    private mapArrayField(field: any[]) {
        return {
            type: 'array',
            items: this.mapSchemaField(field[0])
        }
    }

    private mapSchema(target: any, name: string, { originalSchema }: ApiEdgeSchema) {
        target[name] = this.mapObjectField(originalSchema, name)
    }

    private mapSchemas = () => {
        let output: any = {};
        this.api.edges
            .filter(e => e.schema)
            .forEach(({ name, schema }: ApiEdgeDefinition) => this.mapSchema(output, name, schema));
        return output
    };

    mapV2 = async () => {
        const info = this.api.info || {
            title: "API",
        };

        const api: { [key: string]: any } = {
            swagger: "2.0",
            info: {
                ...info,
                version: this.api.service.version
            },
            consumes: [
                "application/json"
            ],
            produces: [
                "application/json"
            ],
            paths: await this.mapEdges(2),
            definitions: this.mapSchemas()
        };

        if(this.api.url) {
            const parsedURL = URL.parse(this.api.url);
            api.host = parsedURL.host;
            api.basePath = parsedURL.pathname
        }

        return api
    };

    mapV3 = async () => {
        const info = this.api.info || {
            title: "API",
        };

        const api: { [key: string]: any } = {
            openapi: "3.0.0",
            info: {
                ...info,
                version: this.api.service.version
            },
            paths: await this.mapEdges(3),
            components: {
                schemas: this.mapSchemas(),
                securitySchemes: this.securityProvider?.securitySchemes
            }
        };

        if(this.api.url) {
            api.servers = [
                { url: this.api.url }
            ]
        }

        return api
    }

}