import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Star, MapPin, Clock, Users, UserRound, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { fill } from "@/lib/format";
import type { Location, Review } from "@shared/schema";
import barImage from "@assets/bar_1757514529485.jpg";
import libraryImage from "@assets/library_1757514529486.jpg";
import parkImage from "@assets/park_1757514529486.jpg";
import playgroundImage from "@assets/playground_1757514529486.jpg";

function getCategoryImage(category: string): string {
  const categoryLower = category.toLowerCase();
  if (categoryLower.includes('bar') || categoryLower.includes('cafe')) {
    return barImage;
  } else if (categoryLower.includes('library')) {
    return libraryImage;
  } else if (categoryLower.includes('playground')) {
    return playgroundImage;
  } else {
    return parkImage; // Default to park for parks, water parks, etc.
  }
}

interface LocationModalProps {
  location: Location;
  onClose: () => void;
}

interface ReviewWithProfile extends Review {
  profile?: {
    name: string;
    photoUrl: string;
  } | null;
}

export default function LocationModal({ location, onClose }: LocationModalProps) {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [visitedWith, setVisitedWith] = useState("");
  const { toast } = useToast();
  const { t } = useLanguage();

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<ReviewWithProfile[]>({
    queryKey: ["/api/locations", location.id, "reviews"],
  });

  const reviewMutation = useMutation({
    // The server sets userId from the session
    mutationFn: async (reviewData: { locationId: string; rating: number; comment: string; visitedWith: string }) => {
      const response = await apiRequest("POST", "/api/reviews", reviewData);
      return response.json();
    },
    onSuccess: () => {
      setShowReviewForm(false);
      setReviewComment("");
      setVisitedWith("");
      setReviewRating(5);
      queryClient.invalidateQueries({ queryKey: ["/api/locations", location.id, "reviews"] });
      toast({
        title: t("reviewAdded"),
        description: t("reviewAddedDescription"),
      });
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("reviewSendFailed"),
        variant: "destructive",
      });
    },
  });

  const handleSubmitReview = () => {
    if (!reviewComment.trim() || !visitedWith.trim()) {
      toast({
        title: t("missingInfo"),
        description: t("missingInfoReview"),
        variant: "destructive",
      });
      return;
    }

    reviewMutation.mutate({
      locationId: location.id,
      rating: reviewRating,
      comment: reviewComment.trim(),
      visitedWith: visitedWith.trim(),
    });
  };

  const renderStars = (rating: number, interactive = false, onRate?: (rating: number) => void) => {
    return Array.from({ length: 5 }, (_, i) =>
      interactive && onRate ? (
        <button key={i} type="button" onClick={() => onRate(i + 1)} aria-label={`${i + 1}/5`} className="flex h-10 w-9 items-center justify-center">
          <Star className={`h-6 w-6 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ) : (
        <Star key={i} className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ),
    );
  };

  const [latStr, lngStr] = (location.coordinates || "").split(",");
  const mapsUrl =
    location.googleMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${(latStr || "").trim()},${(lngStr || "").trim()}`)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#17111F]/45 backdrop-blur-[3px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={location.name}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[32px] bg-white shadow-[0_-10px_40px_rgba(23,17,31,0.14)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 px-4 pt-4">
          <img src={getCategoryImage(location.category)} alt="" className="h-44 w-full rounded-[28px] object-cover" />
          <button
            type="button"
            className="glass absolute right-7 top-7 flex h-11 w-11 items-center justify-center rounded-full text-gray-900"
            onClick={onClose}
            aria-label={t("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))] pt-5">
          <span className="tag-violet">{location.category}</span>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-gray-900">{location.name}</h2>
          {location.rating > 0 && (
            <div className="mt-2 flex items-center gap-1">
              {renderStars(location.rating)}
              <span className="ml-1 text-sm text-gray-600">{location.rating}/5</span>
            </div>
          )}

          <div className="mt-4 space-y-2.5 text-sm text-gray-700">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
              <span>{location.address}</span>
            </p>
            {location.openingHours && (
              <p className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                <span>{location.openingHours}</span>
              </p>
            )}
            {location.ageGroups.length > 0 && (
              <div className="flex items-start gap-2">
                <Users className="mt-1.5 h-4 w-4 shrink-0 text-gray-500" />
                <div className="flex flex-wrap gap-1.5">
                  {location.ageGroups.map((age, index) => (
                    <span key={index} className="tag-neutral">
                      {fill(t("placeAgesLabel"), { age })}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {location.description && <p className="mt-4 text-[15px] leading-relaxed text-gray-800">{location.description}</p>}

          {location.amenities.length > 0 && (
            <div className="mt-5">
              <h3 className="section-label font-sans tracking-normal">{t("amenities")}</h3>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {location.amenities.map((amenity, index) => (
                  <span key={index} className="tag-neutral">
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Button variant="outline" className="mt-5 w-full" onClick={() => window.open(mapsUrl, "_blank")} data-testid="button-open-maps">
            <Navigation className="h-4 w-4" />
            {t("openInMaps")}
          </Button>

          {/* Reviews */}
          <div className="mt-7">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900">{t("momsReviews")}</h3>
              <Button size="sm" variant="secondary" onClick={() => setShowReviewForm(!showReviewForm)} data-testid="button-add-review">
                {t("addReview")}
              </Button>
            </div>

            {showReviewForm && (
              <div className="mt-3 space-y-3 rounded-3xl bg-gray-50 p-4">
                <div>
                  <span className="section-label">{t("ratingLabel")}</span>
                  <div className="mt-1 flex">{renderStars(reviewRating, true, setReviewRating)}</div>
                </div>
                <div>
                  <label htmlFor="review-with" className="section-label">
                    {t("whoDidYouVisitWith")}
                  </label>
                  <Input
                    id="review-with"
                    value={visitedWith}
                    onChange={(e) => setVisitedWith(e.target.value)}
                    placeholder={t("visitedWithPlaceholder")}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label htmlFor="review-text" className="section-label">
                    {t("yourReview")}
                  </label>
                  <Textarea
                    id="review-text"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder={t("reviewPlaceholder")}
                    className="mt-2 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowReviewForm(false)}>
                    {t("cancel")}
                  </Button>
                  <Button className="flex-1" onClick={handleSubmitReview} disabled={reviewMutation.isPending}>
                    {reviewMutation.isPending ? t("submitting") : t("submitReview")}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-3 space-y-3">
              {reviewsLoading ? (
                <div className="h-20 rounded-3xl skeleton-shimmer" />
              ) : reviews.length === 0 ? (
                <p className="rounded-3xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">{t("noReviewsBeFirst")}</p>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="rounded-3xl bg-gray-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-100">
                        <UserRound className="h-5 w-5 text-pink-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-gray-900">{review.profile?.name || t("placeReviewerFallback")}</span>
                          <div className="flex shrink-0 items-center gap-0.5">{renderStars(review.rating)}</div>
                        </div>
                        {review.visitedWith && (
                          <p className="mt-0.5 text-xs text-gray-600">{fill(t("placeVisitedWith"), { who: review.visitedWith })}</p>
                        )}
                        <p className="mt-1.5 text-sm text-gray-800">{review.comment}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
