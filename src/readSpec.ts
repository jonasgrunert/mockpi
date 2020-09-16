import path from "path";
import ApiParser from "@apidevtools/swagger-parser";
import { OpenAPI } from "openapi-types";

export async function parseSpec(filePath: string): Promise<OpenAPI.Document> {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`The path ${filePath} is not absolute.`);
  }
  const api = ApiParser.dereference(filePath);
  return api as Promise<OpenAPI.Document>;
}
