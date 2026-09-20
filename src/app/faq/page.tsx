export const metadata = { title: "A few good questions" };
export default function Page() {
  return (
    <div className="page wrap">
      <div className="article">
        <p className="eyebrow">A LITTLE CLARITY</p>
        <h1>
          Good questions.
          <br />
          Simple answers.
        </h1>
        {[
          [
            "Is this a real plant shop?",
            "This is a frontend demonstration. Products, prices, stock, delivery zones, payments, and orders are simulated. No real purchase or delivery takes place.",
          ],
          [
            "Where do you deliver?",
            "The demo recognises PIN codes 221001, 221005, and 221010 only. This is fictional configuration, not a verified service-area promise. Demo shipping is ₹49.",
          ],
          [
            "Do plants include a pot?",
            "The sample nursery-pot variant includes a pot. The illustrative ceramic variant adds ₹200. Product photography is illustrative and may differ from the selected option.",
          ],
          [
            "Can I pay cash on delivery?",
            "The demo supports COD for 221001 and 221005. PIN 221010 simulates a prepaid-only zone. No actual cash is collected.",
          ],
          [
            "What happens to my details?",
            "Only cart and wishlist IDs and quantities are saved on this device. Addresses, account state, and newly created orders remain in memory and reset on a full reload.",
          ],
          [
            "Can I cancel an order?",
            "The demo order screen includes simulated cancellation. Real cancellation, replacement, and refund terms require business approval before launch.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
