export async function POST() {
  return Response.json(
    {
      error: {
        code: "FAKE_PRODUCT_RETIRED",
        message: "The deterministic Fake storyboard generator is retired from the product.",
      },
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
