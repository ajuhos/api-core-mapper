### API Mapper

Generate swagger.json for your api-core API.

For example using Express and ApiProvider:
```javascript
const swaggerProvider = require("api-core-mapper").ApiSwaggerProvider;
const swagger = api.provide(swaggerProvider).map();
app.get('/swagger.json', (req, res) => res.send(swagger))
```