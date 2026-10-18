import Link from "next/link";
import { TestListing } from "@/components/tests/test-listing";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `Mock Tests - ${APP_NAME}`,
  description: `Browse available Class 9 and 10 board-focused mock tests on ${APP_NAME}.`,
};

export default function MockTestsPage() {
  return (
    <>
      <div className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link href="/engine-tests" className="text-sm font-semibold text-primary hover:underline">
          Browse generated question-bank practice tests
        </Link>
      </div>
      <TestListing />
    </>
  );
}
