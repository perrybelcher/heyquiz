import { ArrowRight, Check, Film, SlidersHorizontal, Send } from "lucide-react";
import { homepageVideo } from "@/lib/homepage-video";

/** A reserved video stage becomes a native player when a recording is supplied. */
export default function HomepageWalkthrough() {
  return (
    <section className="sales-width walkthrough-section" id="walkthrough" aria-labelledby="walkthrough-title">
      <div className="walkthrough-copy">
        <p className="sales-eyebrow">FROM “I HAVE AN IDEA” TO “HERE’S YOUR MATCH”</p>
        <h2 id="walkthrough-title">See how a few questions<br /><em>create a personal next step.</em></h2>
        <p>Start with what you sell and who you help. Shape the questions. Connect the answers to a useful result. Then put your quiz where your customers already are.</p>
        <ol className="walkthrough-chapters">
          <li><span>01</span><div><strong>Build the conversation</strong><p>Questions that help visitors tell you what matters.</p></div></li>
          <li><span>02</span><div><strong>Make the result personal</strong><p>A product, a scorecard, or advice that fits their answers.</p></div></li>
          <li><span>03</span><div><strong>Give them somewhere to go</strong><p>Publish, share, and measure the next step.</p></div></li>
        </ol>
      </div>
      <div className="walkthrough-stage">
        {homepageVideo.src ? (
          <video controls playsInline preload="none" poster={homepageVideo.poster || undefined} aria-label="How to create and publish a quiz with Pippi">
            <source src={homepageVideo.src} type="video/mp4" />
            {homepageVideo.captions && <track kind="captions" src={homepageVideo.captions} srcLang="en" label="English" default />}
            Your browser does not support embedded video. <a href={homepageVideo.src}>Open the walkthrough</a>.
          </video>
        ) : (
          <div className="walkthrough-placeholder">
            <div className="walkthrough-topline"><span><Film size={16}/> THE PIPPI WALKTHROUGH</span><span>Coming soon</span></div>
            <div className="walkthrough-preview" aria-hidden="true">
              <div className="walkthrough-preview-card"><SlidersHorizontal size={20}/><small>YOUR QUESTION</small><strong>What would help you most right now?</strong><span><Check size={14}/> Finding the right fit</span><span>Knowing where to start</span></div>
              <ArrowRight className="walkthrough-preview-arrow" size={28}/>
              <div className="walkthrough-preview-result"><Check size={24}/><small>THEIR NEXT STEP</small><strong>A recommendation<br/>that makes sense.</strong><span>Explore your match <ArrowRight size={13}/></span></div>
            </div>
            <p>The video walkthrough is on its way.<br/>You can explore the working demo right now.</p>
            <a href="#product-tour" className="sales-button">Explore the interactive demo <Send size={15}/></a>
          </div>
        )}
      </div>
    </section>
  );
}
