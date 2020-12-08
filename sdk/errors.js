const ERROR_NO_CONNECTION = "Could not establish connection. " +
                            "Receiving end does not exist.";

export function ignoreNoConnectionError(promise)
{
  return promise.catch(error =>
  {
    if (typeof error != "object" || error.message != ERROR_NO_CONNECTION)
      throw error;
  });
}
