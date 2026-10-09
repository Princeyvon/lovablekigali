import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

const fetch = createStartHandler(defaultStreamHandler);

export function createServerEntry(entry: { fetch: (...args: unknown[]) => Promise<Response> }) {
  return {
    async fetch(...args: unknown[]) {
      return await entry.fetch(...args);
    },
  };
}

export default createServerEntry({
  fetch: fetch as unknown as (...args: unknown[]) => Promise<Response>,
});
