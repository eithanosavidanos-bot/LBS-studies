import Link from "next/link";

export default function NotFound() {
  return (
    <div className="authwrap">
      <div className="gatecard">
        <div className="eyebrow">Not found</div>
        <h2>That page doesn&apos;t exist.</h2>
        <p className="muted" style={{ margin: 0 }}>
          The link may be old, or the chapter or test isn&apos;t part of this course.
        </p>
        <Link className="btn primary" href="/">
          Back to your courses
        </Link>
      </div>
    </div>
  );
}
