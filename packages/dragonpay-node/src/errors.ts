export class DragonPayError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly apiMessage?: string,
  ) {
    super(message);
    this.name = 'DragonPayError';
  }
}

export class SignatureVerificationError extends DragonPayError {
  constructor(message: string) {
    super(message);
    this.name = 'SignatureVerificationError';
  }
}
