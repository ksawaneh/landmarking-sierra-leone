/**
 * Error handler middleware for dealing with errors thrown in route handlers
 */
export const errorHandler = (error: any) => {
  console.error('Error:', error);
  
  // Handle validation errors
  if (error.name === 'ValidationError') {
    return Response.json(
      {
        error: 'Validation Error',
        message: error.message,
        details: error.details || [],
      },
      { status: 400 }
    );
  }
  
  // Handle not found errors
  if (error.name === 'NotFoundError') {
    return Response.json(
      {
        error: 'Not Found',
        message: error.message,
      },
      { status: 404 }
    );
  }
  
  // Handle unauthorized errors
  if (error.name === 'UnauthorizedError') {
    return Response.json(
      {
        error: 'Unauthorized',
        message: error.message,
      },
      { status: 401 }
    );
  }
  
  // Handle forbidden errors
  if (error.name === 'ForbiddenError') {
    return Response.json(
      {
        error: 'Forbidden',
        message: error.message,
      },
      { status: 403 }
    );
  }
  
  // Handle conflict errors
  if (error.name === 'ConflictError') {
    return Response.json(
      {
        error: 'Conflict',
        message: error.message,
      },
      { status: 409 }
    );
  }
  
  // Handle all other errors as internal server errors
  return Response.json(
    {
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    },
    { status: 500 }
  );
};