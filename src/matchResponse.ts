import MockAPI from ".";
import { OpenAPIV3 } from "openapi-types";
import { IncomingMessage } from "http";
import { URL } from "url";
import { TLSSocket } from "tls";

enum requestMethods {
  post = "post",
  get = "get",
  delete = "delete",
  head = "head",
  options = "options",
  patch = "patch",
  put = "put",
  trace = "trace",
}

function constructURL(req: IncomingMessage): URL {
  return new URL(
    req.url!,
    `http${(<TLSSocket>req.socket).encrypted ? "s" : ""}://${req.headers.host}`
  );
}

// Returns true if the request matches with a given spec up until the path and operation level.
export function matchSpec(
  req: IncomingMessage,
  spec: MockAPI
): false | { path: string; operation: OpenAPIV3.OperationObject } {
  if (spec.isOpenApi()) {
    const openApi = spec.getSpec() as OpenAPIV3.Document;
    const fullUrl = constructURL(req);
    // No servers are given so there was no way for us to conclude if this endpoint should match
    if (!openApi.servers) {
      return false;
    }
    // Do any base paths match, otherwise we have to no chance of matching it
    const matchedServers = openApi.servers
      .filter(server => {
        const serverUrl = new URL(server.url);
        if (serverUrl.protocol !== fullUrl.protocol) return false;
        if (serverUrl.hostname !== fullUrl.hostname) return false;
        if (
          !decodeURI(fullUrl.pathname).startsWith(decodeURI(serverUrl.pathname))
        )
          return false;
        return true;
      })
      .map(server => new URL(server.url));
    if (matchedServers.length === 0) {
      return false;
    }
    // Do any future paths match, otherwise we have to give up
    const matchedRoutes = Object.keys(openApi.paths).filter(path =>
      matchedServers.some(server => {
        const urlParts = decodeURI(fullUrl.pathname)
          .slice(server.pathname.length)
          .split("/")
          .filter(t => t);
        const parts = decodeURI(path)
          .split("/")
          .filter(t => t);
        return (
          parts.length === urlParts.length &&
          urlParts.every(
            (curr, i) =>
              (parts[i] && /\{.+\}/.test(parts[i])) || curr === parts[i]
          )
        );
      })
    );
    if (matchedRoutes.length === 0) {
      return false;
    }
    const operations = matchedRoutes
      .map(path => ({
        path,
        operation:
          openApi.paths[path][req.method?.toLowerCase() as requestMethods],
      }))
      .filter(path => !!path.operation && !path.operation.deprecated) as {
      path: string;
      operation: OpenAPIV3.OperationObject;
    }[];
    // We were unable to find a matching operation
    if (operations.length === 0) {
      return false;
    }
    if (operations.length > 1) {
      return false;
    }
    return operations[0];
  }
  return false;
}

export interface serializedRequest {
  url: URL;
  parameters: Record<string, string>;
  query: Record<string, unknown>;
  method: requestMethods;
}

export function serializeRequest(
  path: string,
  req: IncomingMessage
): serializedRequest {
  const url = constructURL(req);
  const parts = path.split("/").filter(t => t);
  let urlParts = url.pathname.split("/").filter(t => t);
  urlParts = urlParts.slice(urlParts.length - parts.length);
  const parameters: Record<string, string> = parts.reduce((prev, curr, i) => {
    if (/\{.+\}/.test(curr)) {
      const match = /\{.+\}/.exec(curr)![0];
      return { ...prev, [match.slice(1, match.length - 1)]: urlParts[i] };
    }
    return prev;
  }, {});
  const query: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (query[key]) {
      query[key] =
        typeof query[key] === "object"
          ? [...(query[key] as unknown[]), value]
          : [query[key], value];
    } else {
      query[key] = value;
    }
  }
  return {
    url,
    parameters,
    query,
    method: req.method?.toLowerCase() as requestMethods,
  };
}
