// The guide links resolve against the source this workbench was built from, so
// a reader lands on the exact documents shipped beside the running code. This
// fork carries them; the upstream project is credited in README.md and NOTICE.
export const ROUTE_GUIDE_REPOSITORY_URL =
  "https://github.com/ogsortmybricks-crypto/cubed-core";
export const ROUTE_GUIDE_LINK_TARGET = "_blank";
export const ROUTE_GUIDE_LINK_REL = "noopener noreferrer";

export function routeGuideDocumentHref(path: string): string {
  return `${ROUTE_GUIDE_REPOSITORY_URL}/blob/main/${path}`;
}
