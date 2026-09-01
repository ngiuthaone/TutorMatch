export const dynamic = "force-dynamic";

import Client from "./page-client";

export default function Page(props: any) {
  return <Client {...props} />;
}
