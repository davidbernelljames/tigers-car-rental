"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Phone, Mail, MapPin, Clock, CheckCircle2 } from "lucide-react";
import { contactFormSchema, type ContactFormInput } from "@/lib/validations/booking";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useFilteredInput,
  NAME_CHARS,
  PHONE_CHARS,
} from "@/lib/input-filters";

const HOURS = [
  { day: "Every Day", hours: "Open 24 Hours" },
];

export default function ContactPage() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormInput>({ resolver: zodResolver(contactFormSchema) });

  const [submitted, setSubmitted] = React.useState(false);

  const nameFilter = useFilteredInput(NAME_CHARS);
  const phoneFilter = useFilteredInput(PHONE_CHARS);

  async function onSubmit(data: ContactFormInput) {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setSubmitted(true);
      reset();
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-neutral-900">Get in Touch</h1>
      <p className="text-neutral-500 mt-1 mb-8 max-w-xl">
        We are happy to assist with bookings, enquiries, or any questions
        about our vehicles and services.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-neutral-700">
                <Phone className="h-4 w-4 text-customer" /> +1 868-278-7352
              </div>
              <div className="flex items-center gap-2 text-neutral-700">
                <Phone className="h-4 w-4 text-customer" /> +1 868-474-1905
              </div>
              <div className="flex items-center gap-2 text-neutral-700">
                <Mail className="h-4 w-4 text-customer" /> kadesh306@gmail.com
              </div>
              <div className="flex items-center gap-2 text-neutral-700">
                <MapPin className="h-4 w-4 text-customer" /> 4 Ramacharan Drive,
                Factory Road, Piarco, Trinidad
              </div>
              <div className="flex items-center gap-2 text-neutral-700">
                <Clock className="h-4 w-4 text-customer" /> We aim to respond within 2 hours.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="font-semibold text-neutral-900 mb-3 text-sm">
                Operating Hours
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {HOURS.map((h) => (
                    <tr key={h.day} className="border-b border-neutral-50 last:border-0">
                      <td className="py-1.5 text-neutral-500">{h.day}</td>
                      <td className="py-1.5 text-right text-neutral-700">{h.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d980.3950700344615!2d-61.34967556948014!3d10.6119518976564!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8c35ff2a190b2311%3A0x1fe75906c1dcd45f!2sTigers%20car%20rental!5e0!3m2!1sen!2stt!4v1784644453805!5m2!1sen!2stt"
                width="100%"
                height="220"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                title="Tiger's Car Rental location"
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardContent className="pt-6">
              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-10 w-10 text-status-available mx-auto mb-3" />
                  <p className="font-semibold text-neutral-900">Message sent</p>
                  <p className="text-sm text-neutral-500 mt-1">
                    We&apos;ll get back to you within 2 hours during business hours.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => setSubmitted(false)}>
                    Send another message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName" required>Full Name</Label>
                      <Input
                        id="fullName"
                        autoComplete="name"
                        maxLength={100}
                        {...nameFilter}
                        {...register("fullName")}
                        error={!!errors.fullName}
                      />
                      {errors.fullName && (
                        <p className="text-xs text-status-maintenance mt-1">{errors.fullName.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="email" required>Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        maxLength={100}
                        {...register("email")}
                        error={!!errors.email}
                      />
                      {errors.email && (
                        <p className="text-xs text-status-maintenance mt-1">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={20}
                        {...phoneFilter}
                        {...register("phone")}
                        error={!!errors.phone}
                      />
                      {errors.phone && (
                        <p className="text-xs text-status-maintenance mt-1">
                          {errors.phone.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="subject" required>Subject</Label>
                      <Select id="subject" {...register("subject")} defaultValue="General Enquiry">
                        <option>General Enquiry</option>
                        <option>Booking Assistance</option>
                        <option>Vehicle Availability</option>
                        <option>Feedback</option>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="message" required>Message</Label>
                    <Textarea
                      id="message"
                      maxLength={1000}
                      {...register("message")}
                      error={!!errors.message}
                    />
                    {errors.message && (
                      <p className="text-xs text-status-maintenance mt-1">{errors.message.message}</p>
                    )}
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? "Sending…" : "Send Message"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
