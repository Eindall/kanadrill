/** URL d'autorisation OAuth2 (flux « authorization code ») : sert au départ d'une liaison, lancée par un POST. */
export function buildAuthorizationUrl(
  authorizeUrl: string,
  params: { clientId: string; redirectUri: string; scope: string[]; state: string; extra?: Record<string, string> },
): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scope.join(' '),
    state: params.state,
    ...params.extra,
  });
  // Espaces en %20 (comme passport-oauth2), pas en « + ».
  return `${authorizeUrl}?${query.toString().replace(/\+/g, '%20')}`;
}
