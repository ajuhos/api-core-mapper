import {
    Api, ApiEdgeDefinition, ApiEdgeMethod, ApiEdgeRelation, ApiEdgeMethodScope,
    OneToOneRelation, OneToManyRelation
} from "api-core";

export class ApiMapper {

    levelLimit: number = 2;
    private api: Api;

    constructor(api: Api) {
        this.api = api
    }

    private printRoutesSingular = (edge: ApiEdgeDefinition, prefix = "", level = 1): string[] => {
        if(level > this.levelLimit) return [];

        let output = [
            `${prefix}`
        ];

        edge.methods.forEach(
            (method: ApiEdgeMethod) => {
                if(method.scope == ApiEdgeMethodScope.Entry || method.scope == ApiEdgeMethodScope.Collection) {
                    output.push(`${prefix}/${method.name}`)
                }
            });

        edge.relations
            .filter((relation: ApiEdgeRelation) => relation.from == edge)
            .forEach((relation: ApiEdgeRelation) => {
                if(relation instanceof OneToOneRelation) {
                    output = output.concat(
                        this.printRoutesSingular(relation.to, `${prefix}/${relation.name}`, level + 1))
                }
                else {
                    output = output.concat(
                        this.printRoutes(relation.to, `${prefix}/${relation.name}`, level + 1))
                }
            });

        return output
    };

    private printRoutes = (edge: ApiEdgeDefinition, prefix = "", level = 1): string[] => {
        if(level > this.levelLimit) return [];

        let output = [
            `${prefix}`,
            `${prefix}/:${edge.idField}`
        ];

        edge.methods.forEach(
            (method: ApiEdgeMethod) => {
                if(method.scope == ApiEdgeMethodScope.Collection || method.scope == ApiEdgeMethodScope.Edge) {
                    output.push(`${prefix}/${method.name}`)
                }

                if(method.scope == ApiEdgeMethodScope.Entry || method.scope == ApiEdgeMethodScope.Edge) {
                    output.push(`${prefix}/:${edge.idField}/${method.name}`)
                }
            });

        edge.relations
            .filter((relation: ApiEdgeRelation) => relation.from == edge)
            .forEach((relation: ApiEdgeRelation) => {
                if(relation instanceof OneToOneRelation) {
                    output = output.concat(
                        this.printRoutesSingular(relation.to, `${prefix}/:${edge.idField}/${relation.name}`, level + 1))
                }
                else {
                    output = output.concat(
                        this.printRoutes(relation.to, `${prefix}/:${edge.idField}/${relation.name}`, level + 1))
                }
            });

        return output
    };

    private mapEdge = (edge: ApiEdgeDefinition) => {
        return this.printRoutes(edge, `/${edge.pluralName}`);
    };

    map = () => {
        let output: string[] = [];

        this.api.edges.forEach((edge: ApiEdgeDefinition) => {
            this.mapEdge(edge).forEach((route: string) => {
                if(output.indexOf(route) == -1)
                    output.push(route)
            })
        });

        return output
    }

}
