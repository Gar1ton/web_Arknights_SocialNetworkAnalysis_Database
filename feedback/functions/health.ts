/** For reachability tests; touches no data. */
export const onRequestGet: PagesFunction = () =>
  new Response("ok", {
    headers: { "Access-Control-Allow-Origin": "https://gar1ton.github.io" },
  });
