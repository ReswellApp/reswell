import Link from "next/link"
import { Smartphone } from "lucide-react"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("mobile-terms")
}

const LAST_UPDATED = "June 17, 2026"
const SMS_HELP_NUMBER = "+18665886365"
const SMS_HELP_NUMBER_DISPLAY = "(866) 588-6365"

export default function MobileTermsOfServicePage() {
  return (
    <main className="flex-1 py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <Smartphone className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mobile Terms of Service</h1>
            <p className="mt-1 text-muted-foreground">Reswell Inc</p>
            <p className="text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-muted-foreground">
          <section>
            <p className="leading-relaxed">
              The Reswell Inc mobile message service (the &ldquo;Service&rdquo;) is operated by
              Reswell Inc (&ldquo;Reswell Inc&rdquo;, &ldquo;we&rdquo;, or &ldquo;us&rdquo;). Your
              use of the Service constitutes your agreement to these terms and conditions
              (&ldquo;Mobile Terms&rdquo;). We may modify or cancel the Service or any of its
              features without notice. To the extent permitted by applicable law, we may also modify
              these Mobile Terms at any time and your continued use of the Service following the
              effective date of any such changes shall constitute your acceptance of such changes.
            </p>
          </section>

          <section>
            <p className="leading-relaxed">
              By consenting to Reswell Inc&apos;s SMS/text messaging service, you agree to receive
              recurring SMS/text messages from and on behalf of Reswell Inc through your wireless
              provider to the mobile number you provided, even if your mobile number is registered
              on any state or federal Do Not Call list. Text messages may be sent using an
              automatic telephone dialing system or other technology. Service-related messages may
              include updates, alerts, and information (e.g., order updates, account alerts, etc.).
              Promotional messages may include promotions, specials, and other marketing offers
              (e.g., cart reminders).
            </p>
          </section>

          <section>
            <p className="leading-relaxed">
              You understand that you do not have to sign up for this program in order to make any
              purchases, and your consent is not a condition of any purchase with Reswell Inc. Your
              participation in this program is completely voluntary.
            </p>
          </section>

          <section>
            <p className="leading-relaxed">
              We do not charge for the Service, but you are responsible for all charges and fees
              associated with text messaging imposed by your wireless provider. Message frequency
              varies. Message and data rates may apply. Check your mobile plan and contact your
              wireless provider for details. You are solely responsible for all charges related to
              SMS/text messages, including charges from your wireless provider.
            </p>
          </section>

          <section>
            <h2 className="mb-2 mt-8 text-xl font-semibold text-foreground">Opt out</h2>
            <p className="leading-relaxed">
              You may opt-out of the Service at any time. Text the single keyword command{" "}
              <strong className="text-foreground">STOP</strong> to{" "}
              <a href={`sms:${SMS_HELP_NUMBER}?body=STOP`} className="text-primary underline">
                {SMS_HELP_NUMBER_DISPLAY}
              </a>{" "}
              or click the unsubscribe link (where available) in any text message to cancel.
              You&apos;ll receive a one-time opt-out confirmation text message. No further messages
              will be sent to your mobile device, unless initiated by you. If you have subscribed to
              other Reswell Inc mobile message programs and wish to cancel, except where applicable
              law requires otherwise, you will need to opt out separately from those programs by
              following the instructions provided in their respective mobile terms.
            </p>
          </section>

          <section>
            <h2 className="mb-2 mt-8 text-xl font-semibold text-foreground">Support</h2>
            <p className="leading-relaxed">
              For Service support or assistance, text <strong className="text-foreground">HELP</strong>{" "}
              to{" "}
              <a href={`sms:${SMS_HELP_NUMBER}?body=HELP`} className="text-primary underline">
                {SMS_HELP_NUMBER_DISPLAY}
              </a>{" "}
              or email{" "}
              <a href="mailto:help@reswell.app" className="text-primary underline">
                help@reswell.app
              </a>
              .
            </p>
          </section>

          <section>
            <p className="leading-relaxed">
              We may change any short code or telephone number we use to operate the Service at any
              time and will notify you of these changes. You acknowledge that any messages,
              including any STOP or HELP requests, you send to a short code or telephone number we
              have changed may not be received and we will not be responsible for honoring requests
              made in such messages.
            </p>
          </section>

          <section>
            <p className="leading-relaxed">
              The wireless carriers supported by the Service are not liable for delayed or
              undelivered messages. You agree to provide us with a valid mobile number. If you get a
              new mobile number, you will need to sign up for the program with your new number.
            </p>
          </section>

          <section>
            <p className="leading-relaxed">
              To the extent permitted by applicable law, you agree that we will not be liable for
              failed, delayed, or misdirected delivery of any information sent through the Service,
              any errors in such information, and/or any action you may or may not take in reliance
              on the information or Service.
            </p>
          </section>

          <section>
            <p className="leading-relaxed">
              We respect your right to privacy. To see how we collect and use your personal
              information, please see our{" "}
              <Link href="/privacy" className="text-primary underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
