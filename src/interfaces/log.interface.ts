export interface ILogSource {
  service?: string;
  host?: string;
  functionName?: string;
  endpoint?: string;
  requestMethod?: string;
}

export interface IErrorDetails {
  name?: string;
  stack?: string;
  code?: string;
  details?: Record<string, unknown>;
}
