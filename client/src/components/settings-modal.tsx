import { useState, useEffect } from "react";
import { X, Bell, MapPin, Crown, Heart, UserCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const currentUserId = "current-user"; // In a real app, this would come from auth context
  
  
  const [notifications, setNotifications] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('notifications') !== 'disabled';
    }
    return true;
  });
  
  const [geolocation, setGeolocation] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('geolocation') === 'enabled';
    }
    return false;
  });

  // Fetch user's subscription status
  const { data: swipeStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/users', currentUserId, 'swipe-status'],
    queryFn: () => apiRequest('GET', `/api/users/${currentUserId}/swipe-status`).then(res => res.json()),
  });

  // Subscription update mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: (plan: 'free' | 'pro') => 
      apiRequest('PUT', `/api/users/${currentUserId}/subscription`, { plan }).then(res => res.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', currentUserId, 'swipe-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles', currentUserId] });
      toast({
        title: "Subscription Updated",
        description: `Successfully ${data.profile.subscriptionPlan === 'pro' ? 'upgraded to Pro' : 'switched to Free'}!`,
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Could not update your subscription. Please try again.",
        variant: "destructive",
      });
    },
  });


  // Add keyboard support for closing modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


  const handleNotificationToggle = async (checked: boolean) => {
    if (checked) {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotifications(true);
          localStorage.setItem('notifications', 'enabled');
        } else {
          setNotifications(false);
          localStorage.setItem('notifications', 'disabled');
        }
      }
    } else {
      setNotifications(false);
      localStorage.setItem('notifications', 'disabled');
    }
  };

  const handleGeolocationToggle = async (checked: boolean) => {
    if (checked) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setGeolocation(true);
            localStorage.setItem('geolocation', 'enabled');
            localStorage.setItem('latitude', position.coords.latitude.toString());
            localStorage.setItem('longitude', position.coords.longitude.toString());
          },
          (error) => {
            console.error('Geolocation error:', error);
            setGeolocation(false);
            localStorage.setItem('geolocation', 'disabled');
          }
        );
      }
    } else {
      setGeolocation(false);
      localStorage.setItem('geolocation', 'disabled');
      localStorage.removeItem('latitude');
      localStorage.removeItem('longitude');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Settings</h2>
            <p className="text-sm text-gray-600">Customize your HeyMama experience</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Profile Button */}
        <div className="px-6 pt-6 pb-2">
          <Button
            onClick={() => {
              setLocation("/profile");
              onClose();
            }}
            variant="ghost"
            className="w-full justify-start text-left py-4 px-4 bg-pink-50 hover:bg-pink-100 border border-pink-200"
          >
            <UserCircle className="h-5 w-5 mr-3 text-pink-600" />
            <div>
              <div className="font-medium text-gray-900">My Profile</div>
              <div className="text-sm text-gray-500">View and edit your profile</div>
            </div>
          </Button>
        </div>

        {/* Settings Content */}
        <div className="p-6 space-y-6">
          {/* Subscription Section */}
          {!statusLoading && swipeStatus && (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-pink-500" />
                  <Label className="font-medium text-gray-800">Subscription Plan</Label>
                  <Badge variant={swipeStatus.subscriptionPlan === 'pro' ? 'default' : 'secondary'}>
                    {swipeStatus.subscriptionPlan === 'pro' ? 'Pro' : 'Free'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {/* Free Plan Card */}
                  <Card className={`border-2 ${swipeStatus.subscriptionPlan === 'free' ? 'border-pink-200 bg-pink-50' : 'border-gray-200'}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Free Plan</CardTitle>
                        {swipeStatus.subscriptionPlan === 'free' && (
                          <Badge variant="outline" className="text-xs">Current</Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs">Perfect for getting started</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <Heart className="h-3 w-3" />
                          <span>5 swipes per day</span>
                        </div>
                        {swipeStatus.subscriptionPlan === 'free' && (
                          <div className="text-xs text-pink-600 font-medium">
                            {swipeStatus.remainingSwipes === -1 ? 'Unlimited' : `${swipeStatus.remainingSwipes} swipes remaining today`}
                          </div>
                        )}
                      </div>
                      {swipeStatus.subscriptionPlan !== 'free' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-3"
                          onClick={() => updateSubscriptionMutation.mutate('free')}
                          disabled={updateSubscriptionMutation.isPending}
                        >
                          Switch to Free
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Pro Plan Card */}
                  <Card className={`border-2 ${swipeStatus.subscriptionPlan === 'pro' ? 'border-pink-200 bg-pink-50 ' : 'border-gray-200 '}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-1">
                          <Crown className="h-4 w-4 text-pink-500" />
                          Pro Plan
                        </CardTitle>
                        {swipeStatus.subscriptionPlan === 'pro' && (
                          <Badge className="text-xs bg-pink-500">Current</Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs">Unlimited connections</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <Heart className="h-3 w-3" />
                          <span>Unlimited swipes</span>
                        </div>
                      </div>
                      {swipeStatus.subscriptionPlan !== 'pro' && (
                        <Button
                          className="w-full mt-3 bg-pink-500 hover:bg-pink-600"
                          size="sm"
                          onClick={() => updateSubscriptionMutation.mutate('pro')}
                          disabled={updateSubscriptionMutation.isPending}
                        >
                          {updateSubscriptionMutation.isPending ? 'Upgrading...' : 'Upgrade to Pro'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator className="dark:bg-gray-700" />
            </>
          )}

          <Separator />

          {/* Notifications Setting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-gray-600" />
              <div>
                <Label htmlFor="notifications" className="font-medium text-gray-800 ">
                  Notifications
                </Label>
                <p className="text-sm text-gray-600">
                  Get notified about new matches and messages
                </p>
              </div>
            </div>
            <Switch
              id="notifications"
              checked={notifications}
              onCheckedChange={handleNotificationToggle}
            />
          </div>

          <Separator className="dark:bg-gray-700" />

          {/* Geolocation Setting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-gray-600" />
              <div>
                <Label htmlFor="geolocation" className="font-medium text-gray-800 ">
                  Location Services
                </Label>
                <p className="text-sm text-gray-600">
                  Find moms and places near you
                </p>
              </div>
            </div>
            <Switch
              id="geolocation"
              checked={geolocation}
              onCheckedChange={handleGeolocationToggle}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t  bg-gray-50  rounded-b-2xl">
          <div className="flex flex-col gap-3">
            <Button
              onClick={onClose}
              className="w-full bg-pink-500 hover:bg-pink-600 text-white"
            >
              Done
            </Button>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Your privacy is important to us. Settings are stored locally on your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}