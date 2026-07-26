export class ApiError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string, public readonly headers?: Record<string, string>) {
    super(message);
  }
}
