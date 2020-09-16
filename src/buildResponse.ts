import { OpenAPIV3 } from "openapi-types";
import casual from "casual";

export function buildResponse(res: OpenAPIV3.MediaTypeObject): unknown {
  // This is unclever we should wathc what a kind of example gets returned, but vor 0.0.1 it is okay
  if (res.examples) {
    return res.examples;
  }
  if (res.example) {
    return res.example;
  }
  return getExample(res.schema as OpenAPIV3.SchemaObject);
}

function getExample(res: OpenAPIV3.SchemaObject): unknown {
  if (res.example) {
    return res.example;
  }
  if (res.enum && res.enum.length > 0) return casual.random_element(res.enum);
  // Switching based on the type
  switch (res.type) {
    case "boolean":
      return casual.boolean;
    case "integer":
      return casual.integer();
    case "number":
      return casual.double();
    case "string": {
      if (res.format === "date") return casual.date();
      if (res.format === "date-time")
        return `${casual.date()}T${casual.time()}Z`;
      return casual.string;
    }
    case "array": {
      const data = [];
      const count = casual.integer(2, 7);
      for (let i = 0; i < count; i++) {
        data.push(getExample(res.items as OpenAPIV3.SchemaObject));
      }
      return data;
    }
    case "object": {
      return Object.keys(res.properties!).reduce((prev, key) => {
        const obj = res.properties![key] as OpenAPIV3.SchemaObject;
        return {
          ...prev,
          [obj.xml?.attribute ? `@_${key}` : key]: getExample(
            res.properties![key] as OpenAPIV3.SchemaObject
          ),
        };
      }, {});
    }
  }
}
