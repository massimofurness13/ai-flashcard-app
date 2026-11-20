export class QueryRefreshError extends Error {}
export function deviceQueryError(error:unknown):string{
 return error instanceof QueryRefreshError?error.message:"Couldn’t refresh yet. Showing saved data.";
}
