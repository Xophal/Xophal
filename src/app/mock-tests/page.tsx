import { TestListing } from "@/components/tests/test-listing";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `Mock Tests - ${APP_NAME}`,
  description: `Browse available Class 9 and 10 board-focused mock tests on ${APP_NAME}.`,
};

export default function MockTestsPage() {
  return <TestListing />;
}
