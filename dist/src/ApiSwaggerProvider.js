"use strict";
var ApiSwaggerMapper_1 = require("./ApiSwaggerMapper");
var ApiSwaggerProvider = (function () {
    function ApiSwaggerProvider(apis) {
        var _this = this;
        if (apis === void 0) { apis = []; }
        this.levelLimit = 2;
        this.extendedTags = true;
        this.apis = [];
        this.map = function () {
            return _this.apis.map(function (api) {
                var mapper = new ApiSwaggerMapper_1.ApiSwaggerMapper(api);
                mapper.levelLimit = _this.levelLimit;
                mapper.extendedTags = _this.extendedTags;
                return mapper.map();
            });
        };
        this.apis = apis;
    }
    return ApiSwaggerProvider;
}());
exports.ApiSwaggerProvider = ApiSwaggerProvider;
//# sourceMappingURL=ApiSwaggerProvider.js.map