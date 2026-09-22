import { APP_NAME } from "@/constants";
import { ContactPageClient } from "@/components/contact/ContactPageClient";

export const metadata = {
  title: `Contact ${APP_NAME}`,
  description: `Contact the ${APP_NAME} support team for account, technical, and learning questions.`,
};

export default function ContactPage() {
  return <ContactPageClient />;
}
