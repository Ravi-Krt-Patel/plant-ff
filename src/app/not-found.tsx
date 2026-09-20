import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page wrap empty-state">
      <p className="eyebrow">A LITTLE LOST IN THE LEAVES</p>
      <h1 className="page-title">This corner hasn’t grown yet.</h1>
      <p>We couldn’t find that page. Let’s take you somewhere green.</p>
      <Link href="/shop" className="button">
        Back to the plants
      </Link>
    </div>
  );
}
