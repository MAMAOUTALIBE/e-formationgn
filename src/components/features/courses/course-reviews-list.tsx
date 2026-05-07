import { Avatar } from "@/components/ui/avatar";
import { Stars } from "@/components/ui/stars";

interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    image: string | null;
  };
}

interface CourseReviewsListProps {
  reviews: ReviewItem[];
  averageRating: number;
  totalRatings: number;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function CourseReviewsList({
  reviews,
  averageRating,
  totalRatings,
}: CourseReviewsListProps) {
  if (totalRatings === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        Ce cours n&apos;a pas encore reçu d&apos;avis. Soyez le premier à le noter une fois inscrit.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl font-semibold text-foreground">
          {averageRating.toFixed(1)}
        </span>
        <div>
          <Stars rating={averageRating} size="md" />
          <p className="text-xs text-muted-foreground">
            {totalRatings.toLocaleString("fr-FR")} avis
          </p>
        </div>
      </div>

      <ul className="space-y-5">
        {reviews.map((review) => {
          const name = review.user.name ?? review.user.firstName ?? "Élève";
          const initials = name[0]?.toUpperCase() ?? "?";
          return (
            <li
              key={review.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <Avatar src={review.user.image} alt={name} fallback={initials} size={36} />
                <div>
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateFormatter.format(review.createdAt)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Stars rating={review.rating} size="sm" />
                {review.title ? (
                  <p className="text-sm font-medium text-foreground">{review.title}</p>
                ) : null}
              </div>
              {review.comment ? (
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                  {review.comment}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
