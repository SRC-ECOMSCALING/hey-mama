import { useState, useEffect } from "react";
import { X, Bell, MapPin, UserCircle, CalendarDays, Settings as SettingsIcon } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

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
            <h2 className="text-xl font-bold text-gray-800">{t("settingsTitle")}</h2>
            <p className="text-sm text-gray-600">Personalizza la tua esperienza HeyMama</p>
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

        {/* Shortcuts */}
        <div className="px-6 pt-6 pb-2 space-y-3">
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
              <div className="font-medium text-gray-900">{t("profile")}</div>
              <div className="text-sm text-gray-500">{t("viewProfile")}</div>
            </div>
          </Button>
          <Button
            onClick={() => {
              setLocation("/settings");
              onClose();
            }}
            variant="ghost"
            className="w-full justify-start text-left py-4 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200"
          >
            <SettingsIcon className="h-5 w-5 mr-3 text-gray-600" />
            <div>
              <div className="font-medium text-gray-900">{t("settingsTitle")}</div>
              <div className="text-sm text-gray-500">{t("languagePreference")}</div>
            </div>
          </Button>
          <Button
            onClick={() => {
              setLocation("/events");
              onClose();
            }}
            variant="ghost"
            className="w-full justify-start text-left py-4 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200"
          >
            <CalendarDays className="h-5 w-5 mr-3 text-gray-600" />
            <div>
              <div className="font-medium text-gray-900">{t("events")}</div>
              <div className="text-sm text-gray-500">{t("eventsIntro")}</div>
            </div>
          </Button>
        </div>

        {/* Settings Content */}
        <div className="p-6 space-y-6">
          {/* Notifications Setting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-gray-600" />
              <div>
                <Label htmlFor="notifications" className="font-medium text-gray-800">
                  Notifiche
                </Label>
                <p className="text-sm text-gray-600">
                  Ricevi avvisi per nuove connessioni e messaggi
                </p>
              </div>
            </div>
            <Switch
              id="notifications"
              checked={notifications}
              onCheckedChange={handleNotificationToggle}
            />
          </div>

          <Separator />

          {/* Geolocation Setting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-gray-600" />
              <div>
                <Label htmlFor="geolocation" className="font-medium text-gray-800">
                  Servizi di localizzazione
                </Label>
                <p className="text-sm text-gray-600">
                  Trova mamme e luoghi vicino a te
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
        <div className="p-6 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex flex-col gap-3">
            <Button
              onClick={onClose}
              className="w-full text-white"
              style={{ background: "linear-gradient(to right, var(--primary-pink), var(--accent-coral))" }}
            >
              Fatto
            </Button>
            <p className="text-xs text-gray-500 text-center">
              La tua privacy è importante. Le impostazioni sono salvate sul tuo dispositivo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
