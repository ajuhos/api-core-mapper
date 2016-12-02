"use strict";
var ApiMapper_1 = require("./ApiMapper");
var ApiMapProvider = (function () {
    function ApiMapProvider(apis) {
        var _this = this;
        if (apis === void 0) { apis = []; }
        this.levelLimit = 2;
        this.apis = [];
        this.map = function () {
            return _this.apis.map(function (api) {
                var mapper = new ApiMapper_1.ApiMapper(api);
                mapper.levelLimit = _this.levelLimit;
                return {
                    version: api.version,
                    routes: mapper.map()
                };
            });
        };
        this.apis = apis;
    }
    return ApiMapProvider;
}());
exports.ApiMapProvider = ApiMapProvider;
//# sourceMappingURL=ApiMapProvider.js.map