import { X, Phone, MapPin, Clock, Euro } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Service {
  id: string;
  name: string;
  type: "Pediatric Osteopath" | "Midwife";
  address: string;
  phone: string;
  hours: string;
  description: string;
  specialties: string[];
  pricing: string;
}

interface ServicesModalProps {
  onClose: () => void;
}

const services: Service[] = [
  {
    id: "service-1",
    name: "Dr. Emily Johnson",
    type: "Pediatric Osteopath",
    address: "123 Wellness Ave, Downtown",
    phone: "(555) 123-4567",
    hours: "Mon-Fri 9AM-6PM",
    description: "Specialized in gentle osteopathic treatment for babies and children. Focus on developmental issues, sleep problems, and feeding difficulties.",
    specialties: ["Newborn care", "Sleep issues", "Feeding problems", "Developmental delays"],
    pricing: "€85 initial consultation • €65 follow-up"
  },
  {
    id: "service-2",
    name: "Sarah Mitchell",
    type: "Midwife",
    address: "456 Birth Center Rd, Central District",
    phone: "(555) 987-6543",
    hours: "24/7 on-call",
    description: "Experienced certified nurse-midwife providing comprehensive prenatal, birth, and postpartum care with a focus on natural birth.",
    specialties: ["Prenatal care", "Natural birth", "Postpartum support", "Breastfeeding guidance"],
    pricing: "€120 prenatal visit • €2,500 birth package"
  },
  {
    id: "service-3",
    name: "Dr. Michael Chen",
    type: "Pediatric Osteopath",
    address: "789 Healing Way, Riverside Area",
    phone: "(555) 456-7890",
    hours: "Tue-Sat 8AM-5PM",
    description: "Gentle osteopathic care for infants and children. Specialized in treating colic, plagiocephaly, and musculoskeletal issues.",
    specialties: ["Colic treatment", "Head shape issues", "Torticollis", "Birth trauma"],
    pricing: "€90 initial consultation • €70 follow-up"
  },
  {
    id: "service-4",
    name: "Rebecca Thompson",
    type: "Midwife",
    address: "321 Family Care Blvd, Main Street",
    phone: "(555) 234-5678",
    hours: "Mon-Fri 8AM-7PM",
    description: "Home birth specialist and lactation consultant. Providing personalized care throughout pregnancy, birth, and beyond.",
    specialties: ["Home birth", "Water birth", "Lactation support", "Doula services"],
    pricing: "€150 home visit • €3,200 complete birth support"
  }
];

export default function ServicesModal({ onClose }: ServicesModalProps) {

  const groupedServices = services.reduce((acc, service) => {
    if (!acc[service.type]) {
      acc[service.type] = [];
    }
    acc[service.type].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Local Services</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">Healthcare providers in your area</p>
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
        </div>

        {/* Services List */}
        <div className="p-4 space-y-6">
          {Object.entries(groupedServices).map(([type, serviceList]) => (
            <div key={type}>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: type === "Pediatric Osteopath" ? "var(--primary-blue)" : "var(--primary-pink)" }}
                />
                {type}
              </h3>
              
              <div className="space-y-4">
                {serviceList.map((service) => (
                  <div
                    key={service.id}
                    className="p-4 rounded-2xl border dark:border-gray-600 hover:shadow-md transition-shadow bg-gray-50 dark:bg-gray-700"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-white">{service.name}</h4>

                      </div>
                      <Button
                        size="sm"
                        className="rounded-full"
                        style={{ backgroundColor: "var(--primary-pink)", color: "white" }}
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        Call
                      </Button>
                    </div>

                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{service.description}</p>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="h-4 w-4" />
                        {service.address}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="h-4 w-4" />
                        {service.hours}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Euro className="h-4 w-4" />
                        {service.pricing}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {service.specialties.map((specialty, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs"
                          style={{
                            backgroundColor: index % 2 === 0 ? "rgba(244, 166, 205, 0.2)" : "rgba(135, 206, 235, 0.2)",
                            color: index % 2 === 0 ? "var(--primary-pink)" : "var(--primary-blue)"
                          }}
                        >
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-500 text-center">
            These services are recommended by other moms in your area. Always verify credentials and insurance coverage.
          </p>
        </div>
      </div>
    </div>
  );
}