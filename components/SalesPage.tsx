import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  GitBranch,
  Layers,
  ListChecks,
  LockKeyhole,
  MessageCircle,
  MousePointer2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import ProviderIcon from "./ProviderIcon";
import SalesDemo from "./SalesDemo";
import JourneyShowcase from "./JourneyShowcase";
import "./SalesPage.css";
// Keep availability claims aligned with the shipped product. Connector logos
// identify supported pilots; they are not customer endorsements or proof of setup.
const faqs = [
  [
    "What can I create with pippi?",
    "Build product finders, audience segmentation quizzes, category scorecards, forms, and surveys. Start with a marketing template, customize the questions, and set the rules that connect answers to results.",
  ],
  [
    "Can different answers lead to different recommendations?",
    "Yes. Add points to matching outcomes, exclude products that don’t fit, and use conditional logic to show relevant questions. Give each outcome its own explanation and next-step link. Category scorecards show scores across the areas you define.",
  ],
  [
    "Do I have to collect an email before showing results?",
    "You choose. Configure lead capture before or after results, make it optional or required, and set your consent wording. The sample on this page collects no contact information and saves no answers.",
  ],
  [
    "What can I see in analytics?",
    "See starts, completions, captured leads, result views, offer clicks, trends, and outcome segments. Question-level reporting highlights unfinished sessions quiet for at least 30 minutes. Offer clicks are not purchases; revenue attribution and built-in A/B testing are not included yet.",
  ],
  [
    "Can I use my CRM or email platform?",
    "pippi includes webhooks, a direct GoHighLevel connection, and a growing set of CRM and email connectors in pilot. Provider authorization and setup are required. Availability varies by provider; some require your own developer credentials. These connectors are not a built-in email campaign service.",
  ],
  [
    "How do I get access?",
    "Start creating a quiz without signing up. Create a free account and confirm your email when you’re ready to save and publish. All accounts are free. No charges or credit card required.",
  ],
];
/**
 * Shared server-rendered sales page for /welcome and unauthenticated /.
 * Only the two demo components require client state. Keep account reads and
 * authentication in the route, and never pass private workspace data here.
 */
export default function SalesPage() {
  return (
    <div className="hq-sales-page">
      <a href="#main" className="sales-skip">
        Skip to content
      </a>
      <header className="sales-nav">
        <a href="/welcome" aria-label="pippi home">
          <Image
            src="/pippi-logo.svg"
            alt="pippi"
            width={100}
            height={50}
            className="sales-logo"
            priority
          />
        </a>
        <nav aria-label="Main navigation">
          <a href="#product-tour">Product</a>
          <a href="#possibilities">Use cases</a>
          <a href="#analytics">Analytics</a>
          <a href="#integrations">Integrations</a>
        </nav>
        <div className="nav-actions">
          <a className="nav-signin" href="/login">
            Sign in
          </a>
          <a className="nav-login" href="/signup">
            Create account <ArrowRight size={16} />
          </a>
        </div>
      </header>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({"@context":"https://schema.org","@type":"WebSite",name:"Pippi",url:"https://www.pippiapp.com/",description:"Free quiz builder for websites, lead generation, product recommendations, and personalized scorecards."}).replace(/</g,"\\u003c")}} />
      <main id="main">
        <section className="sales-hero sales-width">
          <div className="hero-copy">
            <p className="sales-eyebrow">
              <span className="status-dot" /> THE QUIZ PLATFORM FOR A MORE
              PERSONAL CUSTOMER JOURNEY
            </p>
            <h1>
              Build interactive quizzes. <br />
              Turn visitors into <em>leads.</em>
            </h1>
            <p className="hero-description">
              A free quiz builder for your website. Recommend the right products,
              create personalized scorecards, and learn what your audience needs.
              Start building without code.
            </p>
            <div className="hero-actions">
              <a className="sales-button" href="/create">
                Create your first quiz <ArrowRight size={18} />
              </a>
              <a className="sales-text-link" href="#product-tour">
                Explore the platform <ArrowDown size={16} />
              </a>
            </div>
            <p className="hero-note">
              <Check size={14} /> Free accounts. No charges. <Check size={14} /> Start without signing up
            </p>
          </div>
          <div className="hero-visual">
            <Image
              src="/images/pippi-warm-products.webp"
              alt="Three fictional bags: a burgundy sling, a cream work backpack, and a cognac weekend tote"
              fill
              sizes="(max-width: 800px) 100vw, 54vw"
              priority
            />
            <div className="visual-label">
              <Sparkles size={16} /> THE EVERYDAY EDIT / PRODUCT FINDER
            </div>
            <div className="floating-question">
              <span>01 / A BETTER CONVERSATION</span>
              <strong>
                What would make your
                <br />
                everyday a little easier?
              </strong>
              <div>
                <Check size={14} /> A place for everything
              </div>
            </div>
            <div className="floating-match">
              <span className="match-check">
                <Check size={19} />
              </span>
              <div>
                <small>RECOMMENDATION / EXAMPLE</small>
                <strong>The Workday Pack</strong>
              </div>
            </div>
          </div>
        </section>
        <section className="sales-width integrations-section integrations-early" id="integrations" aria-label="CRM and email integrations">
          <p className="sales-eyebrow">CONNECT TO THE TOOLS YOU ALREADY USE</p>
          <div className="provider-grid">
            {[
              ["hubspot", "HubSpot"],
              ["gohighlevel", "GoHighLevel"],
              ["salesforce", "Salesforce"],
              ["activecampaign", "ActiveCampaign"],
              ["klaviyo", "Klaviyo"],
              ["mailchimp", "Mailchimp"],
              ["zoho", "Zoho CRM"],
              ["twenty", "Twenty CRM"],
            ].map(([id, name]) => (
              <div key={id}>
                <ProviderIcon provider={id} />
                <span>{name}</span>
              </div>
            ))}
          </div>
          <p className="integration-disclosure">
            CRM connectors are in pilot. Provider setup and authorization are
            required; availability varies. Logos identify providers, not
            customers or endorsements.
          </p>
        </section>
        <JourneyShowcase />
        <section className="sales-width demo-section">
          <div className="demo-explainer">
            <p className="sales-eyebrow">LESS PITCH. MORE “THAT’S ME.”</p>
            <h2>
              Let them feel
              <br />
              <em>understood.</em>
            </h2>
            <p>
              A good question does two jobs: it helps you learn about your
              customer, and helps your customer see what matters.
            </p>
            <p>
              Try this three-question product finder. Your answers shape the
              recommendation—including when none of the products is a good fit.
            </p>
            <div className="demo-caption">
              <MousePointer2 size={20} />
              <span>
                This is a working sample.
                <br />
                <strong>Try it. See what changes.</strong>
              </span>
            </div>
          </div>
          <SalesDemo />
        </section>
        <section className="possibilities-section" id="possibilities">
          <div className="sales-width">
            <div className="section-heading">
              <div>
                <p className="sales-eyebrow">
                  ONE BUILDER. DIFFERENT DESTINATIONS.
                </p>
                <h2>
                  What happens after
                  <br />
                  the last question?
                </h2>
              </div>
              <p>
                The result is where curiosity becomes a decision. Make it worth
                getting there.
              </p>
            </div>
            <div className="use-case-grid">
              <article>
                <div className="use-illustration lavender">
                  <ShoppingBag size={32} />
                  <div className="mini-result">
                    <span>Your everyday, simplified</span>
                    <strong>The Everyday Sling</strong>
                    <small>
                      <Check size={12} /> Light, compact, just enough
                    </small>
                  </div>
                </div>
                <span className="case-number">01 / PRODUCT FINDERS</span>
                <h3>Make choosing feel easy.</h3>
                <p>
                  Match answers to the right product or offer. Explain why it
                  fits, rule out mismatches, and link to the next step.
                </p>
                <a href="#demo">
                  Try the product finder <ChevronRight size={16} />
                </a>
              </article>
              <article>
                <div className="use-illustration peach">
                  <Users size={32} />
                  <div className="segment-stack">
                    <span>
                      Just exploring <i />
                    </span>
                    <span>
                      Ready for a plan <i />
                    </span>
                    <span>
                      Let’s get started <Check size={13} />
                    </span>
                  </div>
                </div>
                <span className="case-number">02 / SEGMENTATION</span>
                <h3>Meet them where they are.</h3>
                <p>
                  Help visitors recognize their priorities. Send different
                  audiences to different advice, offers, or calls to action.
                </p>
                <a href="#how-it-works">
                  Explore the approach <ChevronRight size={16} />
                </a>
              </article>
              <article>
                <div className="use-illustration sage">
                  <Target size={32} />
                  <div className="score-example">
                    <strong>A clearer next step</strong>
                    <span>
                      Capture <i style={{ width: "82%" }} />
                    </span>
                    <span>
                      Follow-up <i style={{ width: "58%" }} />
                    </span>
                    <span>
                      Measurement <i style={{ width: "38%" }} />
                    </span>
                    <small>Illustrative scorecard</small>
                  </div>
                </div>
                <span className="case-number">03 / SCORECARDS</span>
                <h3>Turn insight into momentum.</h3>
                <p>
                  Score the areas that matter. Show people where they stand and
                  give them useful guidance to move forward.
                </p>
                <a href="#how-it-works">
                  See how it works <ChevronRight size={16} />
                </a>
              </article>
            </div>
          </div>
        </section>
        <section className="sales-width how-section" id="how-it-works">
          <div className="section-heading">
            <div>
              <p className="sales-eyebrow">FROM FIRST QUESTION TO NEXT STEP</p>
              <h2>
                Thoughtful on the outside.
                <br />
                <em>Flexible underneath.</em>
              </h2>
            </div>
            <a href="/signup" className="sales-text-link">
              Create your account <ArrowRight size={16} />
            </a>
          </div>
          <div className="steps-grid">
            {[
              {
                icon: MessageCircle,
                n: "01",
                title: "Start a conversation.",
                text: "Choose a product finder, segmentation quiz, or scorecard template. Shape the questions around what your audience wants to figure out.",
              },
              {
                icon: GitBranch,
                n: "02",
                title: "Give every answer a purpose.",
                text: "Set conditional paths, outcome points, and exclusions. Add explanations that connect the recommendation to what someone told you.",
              },
              {
                icon: ListChecks,
                n: "03",
                title: "Make the next step clear.",
                text: "Choose when to ask for contact details. Preview the journey, publish a link or embed, and watch how people move through it.",
              },
            ].map(({ icon: Icon, n, title, text }) => (
              <article key={n}>
                <div>
                  <Icon size={24} />
                  <span>{n}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="builder-strip">
            <span>
              <Layers size={17} /> Flexible question types
            </span>
            <span>
              <SlidersHorizontal size={17} /> Editable rules & outcomes
            </span>
            <span>
              <LockKeyhole size={17} /> Consent controls
            </span>
          </div>
        </section>
        <section className="analytics-section" id="analytics">
          <div className="sales-width analytics-grid">
            <div>
              <p className="sales-eyebrow">KNOW WHAT TO IMPROVE NEXT</p>
              <h2>
                See the story
                <br />
                behind <em>the submit.</em>
              </h2>
              <p>
                A total lead count only tells part of the story. See who starts,
                who finishes, which results they reach, and whether they click
                the next step.
              </p>
              <ul>
                <li>
                  <Check /> Find questions where unfinished sessions go quiet.
                </li>
                <li>
                  <Check /> Compare completion trends across date ranges.
                </li>
                <li>
                  <Check /> See leads and offer clicks by outcome.
                </li>
                <li>
                  <Check /> Export question-level data for a closer look.
                </li>
              </ul>
              <p className="analytics-note">
                Optional, consent-gated GA4 and Meta events connect quiz steps
                to your tracking setup.
              </p>
            </div>
            {/* Illustrative figures explain the dashboard, not customer performance. */}
            <div className="analytics-preview">
              <div className="preview-header">
                <span>
                  <BarChart3 size={17} /> Conversion journey
                </span>
                <small>ILLUSTRATIVE DATA</small>
              </div>
              <div className="metric-cards">
                <div>
                  <small>Started</small>
                  <strong>1,000</strong>
                </div>
                <div>
                  <small>Completed</small>
                  <strong>680</strong>
                </div>
                <div>
                  <small>Completion</small>
                  <strong>68%</strong>
                </div>
              </div>
              <div className="funnel-preview">
                {[
                  ["Quiz started", "1,000", 100],
                  ["Quiz completed", "680", 68],
                  ["Results viewed", "620", 62],
                  ["Offer clicked", "186", 18.6],
                ].map(([label, count, width]) => (
                  <div key={label}>
                    <span>
                      {label}
                      <strong>{count}</strong>
                    </span>
                    <div>
                      <i style={{ width: `${width}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="insight-preview">
                <Sparkles size={18} />
                <p>
                  <strong>A step worth reviewing</strong>
                  <br />
                  Look at the wording and effort required where unfinished
                  sessions pause.
                </p>
              </div>
              <p className="preview-footnote">
                Sample numbers demonstrate the dashboard. Offer clicks are not
                purchases.
              </p>
            </div>
          </div>
        </section>
        <section className="sales-width faq-section" id="questions">
          <div>
            <p className="sales-eyebrow">A FEW GOOD QUESTIONS</p>
            <h2>
              Curious?
              <br />
              <em>Good.</em>
            </h2>
          </div>
          <div>
            {faqs.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="sales-width final-cta">
          <p className="sales-eyebrow">A BETTER CONVERSATION STARTS HERE</p>
          <h2>
            Your next customer
            <br />
            has a question.
            <br />
            <em>Start with theirs.</em>
          </h2>
          <p>
            Give them a little clarity. Give your offer a little context.
            <br />
            Make the next step feel like their idea.
          </p>
          <div>
            <a href="/create" className="sales-button">
              Create your first quiz <ArrowRight size={18} />
            </a>
            <a href="/signup" className="sales-text-link">
              Create your account <ArrowRight size={16} />
            </a>
          </div>
          <small>Start building now. Create a free account to save. No credit card.</small>
        </section>
      </main>
      <footer className="sales-width sales-footer">
        <div>
          <Image
            src="/pippi-logo.svg"
            alt="pippi"
            width={100}
            height={50}
          />
          <p>Thoughtful questions. Meaningful next steps.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/lead-generation-quiz-builder">Lead generation quizzes</a>
          <a href="/product-recommendation-quiz-builder">Product recommendation quizzes</a>
          <a href="/scorecard-builder">Scorecard builder</a>
          <a href="#demo">Try the sample</a>
          <a href="#questions">Questions & access</a>
          <a href="/login">Sign in</a>
        </nav>
        <small>© {new Date().getFullYear()} pippi</small>
      </footer>
    </div>
  );
}
