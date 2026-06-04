import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Star, MapPin, Clock, Users, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Location, Review } from "@shared/schema";
import barImage from "@assets/bar_1757514529485.jpg";
import libraryImage from "@assets/library_1757514529486.jpg";
import parkImage from "@assets/park_1757514529486.jpg";
import playgroundImage from "@assets/playground_1757514529486.jpg";

const CURRENT_USER_ID = "current-user";

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

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<ReviewWithProfile[]>({
    queryKey: ["/api/locations", location.id, "reviews"],
  });

  const reviewMutation = useMutation({
    mutationFn: async (reviewData: { locationId: string; userId: string; rating: number; comment: string; visitedWith: string }) => {
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
        title: "Review Added!",
        description: "Thank you for sharing your experience with other moms!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add review. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitReview = () => {
    if (!reviewComment.trim() || !visitedWith.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in your review and who you visited with.",
        variant: "destructive",
      });
      return;
    }

    reviewMutation.mutate({
      locationId: location.id,
      userId: CURRENT_USER_ID,
      rating: reviewRating,
      comment: reviewComment.trim(),
      visitedWith: visitedWith.trim(),
    });
  };

  const renderStars = (rating: number, interactive = false, onRate?: (rating: number) => void) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-5 w-5 ${
          i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
        onClick={interactive && onRate ? () => onRate(i + 1) : undefined}
      />
    ));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl max-h-[90vh] w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="relative">
          <img
            src={getCategoryImage(location.category)}
            alt={location.category}
            className="w-full h-48 object-cover"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-192px)] overflow-y-auto">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{location.name}</h2>
              <div className="flex items-center gap-1 mb-2">
                {renderStars(location.rating)}
                <span className="text-sm text-gray-600 ml-1">({location.rating}/5)</span>
              </div>
            </div>
            <Badge 
              variant="secondary"
              className="ml-2"
              style={{ 
                backgroundColor: "rgba(244, 166, 205, 0.2)",
                color: "var(--primary-pink)"
              }}
            >
              {location.category}
            </Badge>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{location.address}</span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="h-4 w-4" />
              <span className="text-sm">{location.openingHours}</span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="h-4 w-4" />
              <div className="flex flex-wrap gap-1">
                {location.ageGroups.map((age, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="text-xs"
                    style={{ 
                      borderColor: "var(--primary-blue)",
                      color: "var(--primary-blue)"
                    }}
                  >
                    Ages {age}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <p className="text-gray-600 text-sm mb-6 leading-relaxed">{location.description}</p>

          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {location.amenities.map((amenity, index) => (
                <span
                  key={index}
                  className="text-xs px-3 py-1 rounded-full"
                  style={{ 
                    backgroundColor: "rgba(135, 206, 235, 0.2)",
                    color: "var(--accent-powder)"
                  }}
                >
                  {amenity}
                </span>
              ))}
            </div>
          </div>

          {/* Reviews Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Mom Reviews</h3>
              <Button
                size="sm"
                className="text-white"
                style={{ 
                  background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                }}
                onClick={() => setShowReviewForm(!showReviewForm)}
              >
                Add Review
              </Button>
            </div>

            {showReviewForm && (
              <div className="mb-4 p-4 rounded-2xl" style={{ backgroundColor: "var(--warm-gray)" }}>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rating
                  </label>
                  <div className="flex gap-1">
                    {renderStars(reviewRating, true, setReviewRating)}
                  </div>
                </div>
                
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Who did you visit with?
                  </label>
                  <input
                    type="text"
                    value={visitedWith}
                    onChange={(e) => setVisitedWith(e.target.value)}
                    placeholder="e.g., 3-year-old daughter"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-pink focus:border-transparent"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Review
                  </label>
                  <Textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience with other moms..."
                    className="w-full min-h-[80px] resize-none"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    className="flex-1 text-white"
                    style={{ 
                      background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))"
                    }}
                    onClick={handleSubmitReview}
                    disabled={reviewMutation.isPending}
                  >
                    {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowReviewForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {reviewsLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-pink mx-auto"></div>
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">💭</div>
                  <p>No reviews yet. Be the first to share your experience!</p>
                </div>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="p-4 rounded-2xl" style={{ backgroundColor: "var(--warm-gray)" }}>
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                        <UserRound className="w-5 h-5 text-pink-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-800 text-sm">
                            {review.profile?.name || "Mom"}
                          </span>
                          <div className="flex items-center gap-1">
                            {renderStars(review.rating)}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                          Visited with {review.visitedWith}
                        </p>
                        <p className="text-sm text-gray-700">{review.comment}</p>
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