// Previously injected a "Made with Pagemate" link into generated user
// apps, which was a brand leak. The component is kept as an empty
// placeholder so existing e2e test fixtures that target the
// `made-with-dyad.tsx` path keep working; the rendered output is
// nothing at all. Rename or delete once the e2e suite is migrated.
export const MadeWithDyad = () => null;
