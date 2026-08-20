export class AppError extends Error { constructor(public readonly code:string, public readonly statusCode:number, message:string, public readonly details?:unknown) { super(message); } }
export class ValidationError extends AppError { constructor(message='Validation failed', details?:unknown){super('VALIDATION_ERROR',400,message,details)} }
export class AuthenticationError extends AppError { constructor(message='Authentication required'){super('UNAUTHENTICATED',401,message)} }
export class AuthorizationError extends AppError { constructor(message='Forbidden'){super('FORBIDDEN',403,message)} }
export class NotFoundError extends AppError { constructor(message='Resource not found'){super('NOT_FOUND',404,message)} }
export class ConflictError extends AppError { constructor(message='Resource conflict'){super('CONFLICT',409,message)} }
export class InventoryError extends AppError { constructor(message='Insufficient inventory'){super('INVENTORY_ERROR',409,message)} }
export class PaymentError extends AppError { constructor(message='Payment failed'){super('PAYMENT_FAILED',402,message)} }
