"use strict";
var api_core_1 = require("api-core");
var ApiMapper = (function () {
    function ApiMapper(api) {
        var _this = this;
        this.levelLimit = 2;
        this.printRoutesSingular = function (edge, prefix, level) {
            if (prefix === void 0) { prefix = ""; }
            if (level === void 0) { level = 1; }
            if (level > _this.levelLimit)
                return [];
            var output = [
                ("" + prefix)
            ];
            edge.methods.forEach(function (method) {
                if (method.scope == api_core_1.ApiEdgeMethodScope.Entry || method.scope == api_core_1.ApiEdgeMethodScope.Collection) {
                    output.push(prefix + "/" + method.name);
                }
            });
            edge.relations
                .filter(function (relation) { return relation.from == edge; })
                .forEach(function (relation) {
                if (relation instanceof api_core_1.OneToOneRelation) {
                    output = output.concat(_this.printRoutesSingular(relation.to, prefix + "/" + relation.name, level + 1));
                }
                else {
                    output = output.concat(_this.printRoutes(relation.to, prefix + "/" + relation.name, level + 1));
                }
            });
            return output;
        };
        this.printRoutes = function (edge, prefix, level) {
            if (prefix === void 0) { prefix = ""; }
            if (level === void 0) { level = 1; }
            if (level > _this.levelLimit)
                return [];
            var output = [
                ("" + prefix),
                (prefix + "/:" + edge.idField)
            ];
            edge.methods.forEach(function (method) {
                if (method.scope == api_core_1.ApiEdgeMethodScope.Collection || method.scope == api_core_1.ApiEdgeMethodScope.Edge) {
                    output.push(prefix + "/" + method.name);
                }
                if (method.scope == api_core_1.ApiEdgeMethodScope.Entry || method.scope == api_core_1.ApiEdgeMethodScope.Edge) {
                    output.push(prefix + "/:" + edge.idField + "/" + method.name);
                }
            });
            edge.relations
                .filter(function (relation) { return relation.from == edge; })
                .forEach(function (relation) {
                if (relation instanceof api_core_1.OneToOneRelation) {
                    output = output.concat(_this.printRoutesSingular(relation.to, prefix + "/:" + edge.idField + "/" + relation.name, level + 1));
                }
                else {
                    output = output.concat(_this.printRoutes(relation.to, prefix + "/:" + edge.idField + "/" + relation.name, level + 1));
                }
            });
            return output;
        };
        this.mapEdge = function (edge) {
            return _this.printRoutes(edge, "/" + edge.pluralName);
        };
        this.map = function () {
            var output = [];
            _this.api.edges.forEach(function (edge) {
                _this.mapEdge(edge).forEach(function (route) {
                    if (output.indexOf(route) == -1)
                        output.push(route);
                });
            });
            return output;
        };
        this.api = api;
    }
    return ApiMapper;
}());
exports.ApiMapper = ApiMapper;
//# sourceMappingURL=ApiMapper.js.map