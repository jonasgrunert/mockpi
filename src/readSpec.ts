import SwaggerParser from "@apidevtools/swagger-parser";
import path from "path";
import ApiParser from "@apidevtools/swagger-parser";

export async function parseSpec(filePath: string) {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`The path ${filePath} is not absolute.`);
  }
  const api = ApiParser.dereference(filePath);
  return api;
}
