import Mitm from "mitm";
import casual from "casual";
import { OpenAPI, OpenAPIV3 } from "openapi-types";
import { j2xParser as XML } from "fast-xml-parser";
import { parseSpec } from "./readSpec";
import {
  matchSpec,
  serializedRequest,
  serializeRequest,
} from "./matchResponse";
import { buildResponse } from "./buildResponse";

class MockAPI {
  private spec: OpenAPI.Document;
  private pathToFile: string;
  private openApi: boolean;
  private state: number | undefined | ((req: serializedRequest) => number);
  private responses: {
    request: serializedRequest;
    response: unknown;
    code: number;
  }[] = [];
  private transformResponses: {
    requestMatcher: (req: serializedRequest) => boolean;
    value:
      | string
      | ((res: string, req?: serializedRequest, c?: typeof casual) => string);
    config: {
      persist: boolean;
    };
  }[] = [];
  private static initialized = false;
  private static mitm: ReturnType<typeof Mitm>;
  private static mockedAPIs = new Map<string, MockAPI>();

  static async mock(pathToFile: string): Promise<MockAPI> {
    if (!this.initialized) {
      this.mitm = Mitm();
      this.initialized = true;
      this.mitm.on("request", (req, res) => {
        try {
          if (!req.url) {
            throw new Error("The request has no URL Object");
          }
          const specs: MockAPI[] = [];
          const responses: OpenAPIV3.OperationObject[] = [];
          const requests: serializedRequest[] = [];
          for (const spec of this.mockedAPIs.values()) {
            const match = matchSpec(req, spec);
            if (match) {
              specs.push(spec);
              responses.push(match.operation);
              requests.push(serializeRequest(match.path, req));
            }
          }
          if (specs.length === 0) {
            throw new Error("The request could not get matched");
          }
          let code: string = casual.random_key(responses[0].responses!);
          if (specs[0].state) {
            if (typeof specs[0].state === "number") {
              code = `${specs[0].state}`;
            }
            if (typeof specs[0].state === "function") {
              code = `${specs[0].state(requests[0])}`;
            }
          }
          res.statusCode = +code;
          const response = responses[0].responses![
            code
          ] as OpenAPIV3.ResponseObject;
          let contentType: boolean | string = false;
          if (response.content) {
            contentType = Object.keys(response.content!)[0];
            if (contentType) {
              res.setHeader("Content-Type", contentType);
            }
          }
          let objectValue: unknown;
          if (contentType) {
            objectValue = buildResponse(response.content![contentType]);
          }
          let value = response.description;
          if (contentType && /json/.test(contentType)) {
            value = JSON.stringify(objectValue);
          }
          if (contentType && /xml/.test(contentType)) {
            value = new XML({}).parse(objectValue);
          }
          const transformResponse = specs[0].transformResponses.filter(
            ({ requestMatcher }) => requestMatcher(requests[0])
          );
          if (transformResponse.length !== 0) {
            value = transformResponse.reduce((prev, { value: curr }) => {
              if (typeof curr === "string") return curr;
              if (typeof curr === "function")
                return curr(prev, requests[0], casual);
              return prev;
            }, value);
          }
          specs[0].responses.push({
            request: requests[0],
            response:
              contentType && transformResponse.length === 0
                ? objectValue
                : value,
            code: +code,
          });
          res.end(value);
        } catch (err) {
          res.statusCode = 500;
          res.end(err.message);
        } finally {
          req.destroy();
        }
      });
    }
    if (this.mockedAPIs.has(pathToFile)) {
      return this.mockedAPIs.get(pathToFile)!;
    }
    return parseSpec(pathToFile).then(s => {
      return this.registerAPI(new MockAPI(s, pathToFile));
    });
  }

  private static registerAPI(api: MockAPI) {
    this.mockedAPIs.set(api.pathToFile, api);
    return api;
  }

  static unmock(api: MockAPI): void {
    this.mockedAPIs.delete(api.pathToFile);
  }

  private constructor(spec: OpenAPI.Document, pathToFile: string) {
    this.spec = spec;
    this.pathToFile = pathToFile;
    this.openApi = !!(<OpenAPIV3.Document>spec).openapi;
  }

  isOpenApi(): boolean {
    return this.openApi;
  }

  getSpec(): OpenAPI.Document {
    return this.spec;
  }

  withState(code: number | ((req: serializedRequest) => number)): void {
    this.state = code;
  }

  withResponse(
    requestMatcher: (req: serializedRequest) => boolean,
    value:
      | string
      | ((res: string, req?: serializedRequest, c?: typeof casual) => string),
    config: {
      persist: boolean;
    } = {
      persist: false,
    }
  ): void {
    this.transformResponses.push({
      requestMatcher,
      value,
      config,
    });
  }

  getResponse({
    method,
    path,
  }: {
    method?: string;
    path?: RegExp;
  } = {}): {
    request: serializedRequest;
    response: unknown;
    code: number;
  } {
    return this.responses.filter(({ request }) => {
      let methodEqual = true;
      let pathEqual = true;
      if (method && request.method.toLowerCase() !== method.toLowerCase()) {
        methodEqual = false;
      }
      if (path && !path.test(request.url.toString())) {
        pathEqual = false;
      }
      return methodEqual && pathEqual;
    })[0];
  }

  getCallCount(): number {
    return this.responses.length;
  }

  getResponses(): {
    request: serializedRequest;
    response: unknown;
    code: number;
  }[] {
    return this.responses;
  }

  reset(): void {
    this.responses = [];
    this.state = undefined;
    this.transformResponses = this.transformResponses.filter(
      ({ config: { persist } }) => !persist
    );
  }
}

export default MockAPI;
