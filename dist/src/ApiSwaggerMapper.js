"use strict";
var api_core_1 = require("api-core");
var ApiSwaggerMapper = (function () {
    function ApiSwaggerMapper(api) {
        var _this = this;
        this.levelLimit = 2;
        this.extendedTags = true;
        this.provideRoutesSingular = function (target, tag, edge, prefix, level) {
            if (prefix === void 0) { prefix = ""; }
            if (level === void 0) { level = 1; }
            if (level > _this.levelLimit)
                return [];
            ApiSwaggerMapper.providePath(target, tag, "" + prefix, ApiSwaggerMapper.generateAllOperations());
            edge.methods.forEach(function (method) {
                if (method.scope == api_core_1.ApiEdgeMethodScope.Entry || method.scope == api_core_1.ApiEdgeMethodScope.Collection) {
                    ApiSwaggerMapper.providePath(target, tag, prefix + "/" + method.name, ApiSwaggerMapper.generateGetOperation());
                }
            });
            edge.relations
                .filter(function (relation) { return relation.from == edge; })
                .forEach(function (relation) {
                if (relation instanceof api_core_1.OneToOneRelation) {
                    _this.provideRoutesSingular(target, _this.extendedTags ? tag + "/" + relation.name : tag, relation.to, prefix + "/" + relation.name, level + 1);
                }
                else {
                    _this.provideRoutes(target, _this.extendedTags ? tag + "/" + relation.name : tag, relation.to, prefix + "/" + relation.name, level + 1);
                }
            });
        };
        this.provideRoutes = function (target, tag, edge, prefix, level) {
            if (prefix === void 0) { prefix = ""; }
            if (level === void 0) { level = 1; }
            if (level > _this.levelLimit)
                return [];
            ApiSwaggerMapper.providePath(target, tag, "" + prefix, ApiSwaggerMapper.generateAllOperations());
            ApiSwaggerMapper.providePath(target, tag, prefix + "/{" + edge.idField + "}", ApiSwaggerMapper.generateAllOperations(edge.idField));
            edge.methods.forEach(function (method) {
                if (method.scope == api_core_1.ApiEdgeMethodScope.Collection || method.scope == api_core_1.ApiEdgeMethodScope.Edge) {
                    ApiSwaggerMapper.providePath(target, tag, prefix + "/" + method.name, ApiSwaggerMapper.generateGetOperation());
                }
                if (method.scope == api_core_1.ApiEdgeMethodScope.Entry || method.scope == api_core_1.ApiEdgeMethodScope.Edge) {
                    ApiSwaggerMapper.providePath(target, tag, prefix + "/{" + edge.idField + "}/" + method.name, ApiSwaggerMapper.generateGetOperation(edge.idField));
                }
            });
            edge.relations
                .filter(function (relation) { return relation.from == edge; })
                .forEach(function (relation) {
                if (relation instanceof api_core_1.OneToOneRelation) {
                    _this.provideRoutesSingular(target, _this.extendedTags ? tag + "/" + relation.name : tag, relation.to, prefix + "/{" + edge.idField + "}/" + relation.name, level + 1);
                }
                else {
                    _this.provideRoutes(target, _this.extendedTags ? tag + "/" + relation.name : tag, relation.to, prefix + "/{" + edge.idField + "}/" + relation.name, level + 1);
                }
            });
        };
        this.mapEdge = function (target, edge) {
            _this.provideRoutes(target, edge.pluralName, edge, "/" + edge.pluralName);
        };
        this.mapEdges = function () {
            var output = {};
            _this.api.edges.forEach(function (edge) { return _this.mapEdge(output, edge); });
            return output;
        };
        this.mapDefinitions = function () {
            return {};
        };
        this.map = function () {
            return {
                swagger: "2.0",
                info: {
                    title: "API",
                    version: _this.api.version
                },
                consumes: [
                    "application/json"
                ],
                produces: [
                    "application/json"
                ],
                paths: _this.mapEdges(),
                definitions: _this.mapDefinitions()
            };
        };
        this.api = api;
    }
    ApiSwaggerMapper.provideOperation = function (target, path, tag, name, description, parameterName) {
        if (parameterName) {
            target[name] = {
                summary: description,
                description: description,
                tags: [tag],
                parameters: [
                    {
                        name: parameterName,
                        "in": "path",
                        required: true
                    }
                ],
                responses: {
                    "200": {
                        description: "The requested entry"
                    }
                }
            };
            if (name == "get") {
                target[name].responses["404"] = {
                    description: "Not Found"
                };
            }
        }
        else {
            target[name] = {
                summary: description,
                description: description,
                tags: [tag],
                responses: {
                    "200": {
                        description: "The requested entry"
                    }
                }
            };
        }
        if (name == "post") {
            target[name].responses = {
                "201": {
                    description: "Created"
                }
            };
        }
    };
    ApiSwaggerMapper.providePath = function (target, tag, path, operations) {
        target[path] = {};
        operations.forEach(function (operation) {
            return ApiSwaggerMapper.provideOperation(target[path], path, tag, operation.name, operation.description, operation.parameter);
        });
    };
    ApiSwaggerMapper.generateAllOperations = function (idParam) {
        if (idParam === void 0) { idParam = ""; }
        var extra = idParam ? " by id" : "";
        var output = [
            { name: "get", description: idParam ? "Get a single entry" : "Get a list of entries", parameter: idParam },
            { name: "put", description: "Replace an existing entry" + extra, parameter: idParam },
            { name: "patch", description: "Modify an existing entry" + extra, parameter: idParam },
            { name: "delete", description: "Delete an existing entry" + extra, parameter: idParam },
        ];
        if (!idParam) {
            output.push({ name: "post", description: "Create a new entry", parameter: idParam });
        }
        return output;
    };
    ApiSwaggerMapper.generateGetOperation = function (idParam) {
        if (idParam === void 0) { idParam = ""; }
        return [
            { name: "get", description: idParam ? "Get a single entry" : "Get a list of entries", parameter: idParam }
        ];
    };
    return ApiSwaggerMapper;
}());
exports.ApiSwaggerMapper = ApiSwaggerMapper;
//# sourceMappingURL=ApiSwaggerMapper.js.map