import { localMode } from "@/lib/auth";
import Login from "@/components/Login";
export default function LoginPage() {
  return <Login local={localMode()} />;
}
