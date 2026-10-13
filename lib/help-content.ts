export interface HelpArticle { slug: string; category: string; title: string; summary: string; sections: { title: string; body: string }[] }
export const helpArticles: HelpArticle[] = [
  {
    "slug": "first-quiz",
    "category": "Start here",
    "title": "Your first quiz, from idea to published link",
    "summary": "A short route through the essentials.",
    "sections": [
      {
        "title": "Choose your starting point",
        "body": "Open Create. Choose Blank to write everything yourself, Templates for an editable starting point, Wizard for guided setup, or AI for a generated draft. AI requires a signed-in account and an available AI connection."
      },
      {
        "title": "Build a small first version",
        "body": "Start with three useful questions and one clear result. Ask about the visitor’s goal, their current situation and their preferred next step. Give people honest alternatives; avoid forcing every answer toward the same recommendation."
      },
      {
        "title": "Style, preview, publish",
        "body": "Open Theme to match your brand. Preview every answer path, including required fields and Back navigation. Sign in to save and publish. Use the published link from Share, then submit a test response and check Results and Contacts. Saving a draft does not automatically update the live quiz."
      }
    ]
  },
  {
    "slug": "creation-paths",
    "category": "Start here",
    "title": "Blank, template, wizard or AI?",
    "summary": "Choose how much help you want.",
    "sections": [
      {
        "title": "Blank",
        "body": "Choose Create → Blank for direct control. Add fields, write questions and arrange pages in the full editor. You can open the setup checklist when you need a guided next step."
      },
      {
        "title": "Templates and wizard",
        "body": "Templates provide an editable structure. Replace sample questions, images and results before publishing. The wizard helps you build in stages; inspect the resulting questions and scoring rather than assuming a draft is ready."
      },
      {
        "title": "AI",
        "body": "AI creates a draft from your brief. Describe your audience, offer and desired outcome. Review factual claims, answer options, scores and result links before publishing. If AI is unavailable, use Blank or a template; your quiz does not need AI to run."
      }
    ]
  },
  {
    "slug": "pages-and-fields",
    "category": "Build your quiz",
    "title": "Put several fields on one page",
    "summary": "Collect contact details together without extra slides.",
    "sections": [
      {
        "title": "Choose Form before arranging the page",
        "body": "Open your quiz in the full editor. Above the page tabs, find How visitors see your questions and choose Form · Fields together by page. Page tabs organize questions in both modes, but only Form renders those fields together. Cards displays one question per screen even when several questions share a page."
      },
      {
        "title": "Example: first name, last name and email together",
        "body": "Select the page that should collect contact details. Add a Short answer field and name it First name. Add another Short answer named Last name, then an Email address field. Select each field and check its Page setting points to the same page. If a field already exists elsewhere, change its Page setting instead of creating a duplicate. Add a heading or supporting description on this page if needed."
      },
      {
        "title": "Decide what is required",
        "body": "Require only information needed to provide the result or follow-up. For example, require Email address but leave Last name optional. Explain why you need the address in the question description. Collection and consent are different: asking for an address does not itself grant marketing permission."
      },
      {
        "title": "Add another stage",
        "body": "Add a separate page for the next group of questions. Assign those fields to that page. Keep each page focused: contact details on one page and needs/preferences on another is easier to scan than a long unrelated form. Use Cards instead when you want each answer to receive its own screen."
      },
      {
        "title": "Preview a realistic path",
        "body": "In Preview, leave a required field empty and try Next: you should remain on that page with validation. Fill valid values, advance, then use Back and check values remain. Test a narrow/mobile viewport. If branches hide fields, test both visible and hidden paths; grouped pages follow the resolved path rather than forcing hidden questions to appear."
      },
      {
        "title": "If fields still appear separately",
        "body": "Check the presentation is Form, verify the Page setting on every field, and reopen Preview after the draft is saved. If Preview looks right but the public link is old, Publish again and open the link from Share. Grouped pages give grading at the end; they do not show immediate per-question grading."
      }
    ]
  },
  {
    "slug": "questions",
    "category": "Build your quiz",
    "title": "Write and arrange questions",
    "summary": "Make each question easy to answer.",
    "sections": [
      {
        "title": "Choose a field",
        "body": "Use a short answer for a brief response, email for an address, multiple choice for one choice, and multi-select for several. Use display fields for supporting content rather than expecting them to collect answers."
      },
      {
        "title": "Make the purpose clear",
        "body": "Use a short question title and a description when context matters. Mark a field required only when it is needed. Keep contact collection brief and explain why you are asking."
      },
      {
        "title": "Preview the experience",
        "body": "Check long labels, mobile layout, required-field errors and the Back button. Page tabs organize fields; enable Fields together by page if they should appear on a single screen."
      }
    ]
  },
  {
    "slug": "scoring",
    "category": "Scoring and results",
    "title": "Give different answers different scores",
    "summary": "Separate answer scoring from result selection.",
    "sections": [
      {
        "title": "Assign answer scores",
        "body": "Select a choice question and open its scoring controls. Set the points for each answer option; do not rely on a single question-level points value to distinguish every answer. Use a low and high answer to verify the score changes."
      },
      {
        "title": "Choose the result model",
        "body": "A scored assessment measures answers; segmentation routes people to relevant outcomes. Use category scores for distinct dimensions and result weights for recommendation outcomes. Review the available scoring mode before editing weights."
      },
      {
        "title": "Test boundaries",
        "body": "Preview low, middle and high scoring paths. Check ties and thresholds, skipped questions, multi-select answers and changed answers. Do not publish until each intended result can be reached. A preview is not proof that a live response was saved."
      },
      {
        "title": "Choose what your score means",
        "body": "A knowledge quiz awards points for correct answers. A marketing assessment may assign different answer contributions to categories or recommendations. Decide which of those you need before changing numbers: “correct” is not the same as “a stronger match for this product.” Use the scoring controls for the quiz’s actual mode."
      },
      {
        "title": "Example: different answers should produce different results",
        "body": "For a readiness assessment, use answers such as Not started, In progress and Established. Assign increasing contributions to the intended category in Answer scoring. Complete three test runs, changing only that answer. The category result should change in the intended direction. If it does not, check that the rules target the intended category and that other questions are not overriding the result."
      },
      {
        "title": "Check multiple selections and unmapped choices",
        "body": "Multi-select can add contributions from several selected answers. Test one selection and two selections separately. An unmapped selection is neutral, not necessarily a scored zero. Exclusion rules can rule out an outcome even if other answers add points to it. Inspect the scoring explanation before treating the total as a simple sum."
      },
      {
        "title": "When every answer seems to score the same",
        "body": "Check whether you changed the question-level Points for a correct answer rather than the answer’s category or outcome contribution. Verify each answer’s mapping, confirm the quiz mode, and test a single changed answer in Preview. If the saved draft works but the public quiz does not, publish the change and use a fresh response. Do not edit historical responses to make a test look correct."
      }
    ]
  },
  {
    "slug": "logic",
    "category": "Build your quiz",
    "title": "Branching and the Conversation Studio",
    "summary": "Keep the journey relevant and understandable.",
    "sections": [
      {
        "title": "Create a branch",
        "body": "Use logic rules to show, hide or jump based on an earlier answer. Give each branch a sensible destination. Avoid loops and references to deleted questions."
      },
      {
        "title": "Review the journey",
        "body": "Open Conversation Studio to see the question journey together. Use it to identify disconnected results, unnecessary questions and routes that do not serve the visitor’s goal."
      },
      {
        "title": "Test every route",
        "body": "Answer the quiz as different visitor types. Change an earlier answer and confirm later fields and results update correctly. Test grouped pages with conditional fields as well as single-question presentation."
      }
    ]
  },
  {
    "slug": "theme",
    "category": "Design",
    "title": "Match your brand",
    "summary": "Style the quiz independently of its host website.",
    "sections": [
      {
        "title": "Open Theme",
        "body": "Use the Theme button in the editor. Adjust the available colors, typography and presentation options, then apply the theme. Check text and button contrast against your chosen backgrounds."
      },
      {
        "title": "Embedded appearance",
        "body": "An iframe quiz uses its own theme. It does not automatically inherit the CSS of the website containing it. Set the accent and background colors in Pippi to coordinate with the host page."
      },
      {
        "title": "Check both sizes",
        "body": "Preview desktop and mobile. Check readable labels, image crops and button contrast. Test the actual embed after publishing because the host page controls the space around the iframe."
      }
    ]
  },
  {
    "slug": "results",
    "category": "Scoring and results",
    "title": "Create useful results and next steps",
    "summary": "Explain the result before asking for action.",
    "sections": [
      {
        "title": "Write the result",
        "body": "Give each outcome a meaningful title, a plain-language explanation and useful next steps. Connect recommendations to the answers rather than promising the same outcome to everyone."
      },
      {
        "title": "Customize the presentation",
        "body": "Use the result and report design controls to configure the available sections, colors and content. Check every outcome, including score boundaries and missing optional answers."
      },
      {
        "title": "Check the action",
        "body": "Use a relevant product, booking or next-step link. Verify that it opens the intended destination. Do not treat an offer click as a confirmed sale. Test report downloads separately from the on-screen result."
      }
    ]
  },
  {
    "slug": "saving",
    "category": "Account and publishing",
    "title": "Autosave, browser drafts and recovery",
    "summary": "Know where your work is saved.",
    "sections": [
      {
        "title": "Know which copy you are editing",
        "body": "A guest draft is stored in this browser on this device. A signed-in saved draft is associated with your account. A published quiz is the version visitors can access. These are three different states; a local backup is useful recovery protection but is not a substitute for an account save."
      },
      {
        "title": "Save your first quiz",
        "body": "Start editing, then use the account prompt to sign in or create a free account when you want to save or publish. Keep the editing tab open through the account flow. After returning, inspect the quiz and wait for Saved. If it says Saved on this device or Not synced, do not assume the cloud copy has been saved."
      },
      {
        "title": "Apply nested editor changes",
        "body": "Report design and Result email copy have their own Apply buttons. Changes in those panels can be pending even while the overall quiz says Saved. Click Apply report design or Apply email copy first, then wait for the quiz save status. Publish afterward to use the applied settings for new responses."
      },
      {
        "title": "When saving fails",
        "body": "Keep the editing tab open. Read the visible message: an expired session requires sign-in, while a connection failure may need a retry. Restore connectivity and use the offered save retry. Avoid opening competing copies of the same quiz or clearing site data. Do not close the only tab holding changes until the status is Saved or you have preserved your wording elsewhere."
      },
      {
        "title": "Recover a browser draft",
        "body": "If a recovery notice or Continue editing draft appears, inspect it and restore the appropriate draft. Use available draft history checkpoints to compare before restoring. Local recovery is limited to the browser/storage that retained it; clearing storage, private browsing and changing devices can remove access. It is not guaranteed recovery for every failure."
      },
      {
        "title": "Verify before sharing",
        "body": "Reopen the quiz from your workspace to verify the account copy. Publish and test the public Share link separately. A saved draft can contain changes visitors will not see until publication."
      }
    ]
  },
  {
    "slug": "publishing",
    "category": "Account and publishing",
    "title": "Publish, share and update a quiz",
    "summary": "Turn a saved draft into a public experience.",
    "sections": [
      {
        "title": "Prepare",
        "body": "Sign in, save the quiz and preview it. Check required fields, result links, score paths and lead capture. Resolve the readiness checks shown by the editor."
      },
      {
        "title": "Publish",
        "body": "Select Publish and wait for confirmation. Share the public link from Share, not the editor URL. Verify the link in a separate browser session."
      },
      {
        "title": "Update or pause",
        "body": "New edits can remain unpublished until you publish again. Use the publication status to see whether changes are pending. Pause publication when you want to stop accepting visitors. Verify the public page after a publication change."
      },
      {
        "title": "Use the public link, not the editor link",
        "body": "After Publish succeeds, open Share and copy the Direct Player URL. An editor URL requires access to the account; a preview can behave differently from the published quiz. Open the public URL in a separate signed-out browser session and verify it starts normally."
      },
      {
        "title": "Example release checklist",
        "body": "For a three-question quiz, test each answer path, one missing required answer, Back navigation, and the final result. Check the result button destination. Publish, submit one fresh response using your own test details, then verify the response appears in reporting. A page loading successfully is only the first part of this check."
      },
      {
        "title": "If Publish asks for an account",
        "body": "Guest editing lets you prepare a quiz, but saving to an account and publishing require sign-in. Keep the draft tab open, use the account prompt and return to the editor. Wait for Saved before retrying Publish. Do not clear the browser draft while the account flow is unfinished."
      },
      {
        "title": "If a shared link is unavailable",
        "body": "Confirm publication succeeded, the quiz is not paused, and the link was copied from Share for this quiz. If it was copied before publication, publish first and retry. If the direct link works but an embed fails, investigate the website’s embed configuration instead of repeatedly republishing."
      }
    ]
  },
  {
    "slug": "embedding",
    "category": "Account and publishing",
    "title": "Embed on your website",
    "summary": "Use the published quiz in your own page.",
    "sections": [
      {
        "title": "Get the code",
        "body": "Publish your quiz and open Share. Copy the iframe embed code into an HTML or embed block on your site. Your website builder must allow iframes."
      },
      {
        "title": "Match and resize",
        "body": "Set your quiz’s Theme independently from your website’s CSS. Use the responsive embed options provided by Pippi; test height, scrolling and mobile width on the actual host page."
      },
      {
        "title": "Troubleshoot",
        "body": "If you see an unavailable quiz, verify the direct public link, publication status and correct quiz ID. A working editor preview does not prove a public link is available. Check the website builder’s iframe restrictions."
      }
    ]
  },
  {
    "slug": "contacts",
    "category": "Leads and analytics",
    "title": "Find leads and their answers",
    "summary": "Separate captured contacts from anonymous activity.",
    "sections": [
      {
        "title": "Capture details",
        "body": "Configure the lead capture step and its placement. Ask only for information needed for the next step. Explain how details will be used and configure the available consent settings."
      },
      {
        "title": "Find responses",
        "body": "Open the quiz’s Contacts and Results sections. A captured lead and a quiz visit are different records; not every visitor submits or supplies contact details. Use available filters to investigate segments."
      },
      {
        "title": "Export carefully",
        "body": "Review the columns and filters before exporting. Treat answers and contact details as private. Do not paste them into the help assistant; a general description of the issue is enough."
      }
    ]
  },
  {
    "slug": "analytics",
    "category": "Leads and analytics",
    "title": "Read completion and conversion reports",
    "summary": "Interpret the funnel without overclaiming.",
    "sections": [
      {
        "title": "Follow the funnel",
        "body": "Compare visits, starts, completions and captured leads using the available reporting views. Check the selected date range and whether you are looking at preview or live activity."
      },
      {
        "title": "Investigate drop-off",
        "body": "Look for the questions where visitors stop. Required fields, unclear wording or irrelevant questions are hypotheses to test, not automatic explanations. Low sample sizes can mislead."
      },
      {
        "title": "Understand limits",
        "body": "Offer clicks do not establish purchases. Browser blocking, consent and interrupted sessions can limit tracking. Verify a real published submission appears in results before relying on a new quiz’s reports."
      }
    ]
  },
  {
    "slug": "email-and-pdf",
    "category": "Scoring and results",
    "title": "Result emails and PDF reports",
    "summary": "Test delivery and downloads separately.",
    "sections": [
      {
        "title": "Understand the three separate pieces",
        "body": "The result screen, saved report/PDF and result email are separate. Report design controls the saved report and PDF; it does not replace the quiz player’s result layout. The email contains a private result link where the recipient can open and download their report. It is not an automatic marketing campaign or a PDF attachment sent to every captured lead."
      },
      {
        "title": "Customize the email wording",
        "body": "In the guided editor, open the results step and expand Result email copy. In the full editor, look for Result email copy alongside Report design in Quiz Completion & Outcomes. Fill Email subject, Email introduction and Email sign-off (optional). You can use {quiz_title} and {brand_name}. For example: subject “Your {quiz_title} result”; introduction “Here is your result and a practical next step. Open your private report using the link below.” Click Apply email copy. Wait for Saved, then Publish for new responses. The sample preview never sends an email; existing responses retain their original copy."
      },
      {
        "title": "Design the PDF",
        "body": "Expand Report design. Choose Editorial or Executive, decide whether to add a cover, and edit the available title, introduction, sections and call to action. Click Apply report design, wait for Saved and Publish. The live sample is illustrative; use an actual completed test response to verify PDF pagination. Logos, images and videos remain online rather than appearing in the native PDF."
      },
      {
        "title": "Request a result email as a respondent",
        "body": "Complete the published quiz. In Keep your result, select Create private result link. When delivery is configured, Email your result appears. Enter your own test address, check “Email me my private result link”, and select Email my result. This is a separate request from marketing consent. A quiz email field alone does not trigger this request. If you only see a local test option, that environment does not send real emails."
      },
      {
        "title": "Verify the report and delivery",
        "body": "Open the saved result and download its PDF. Check the outcome, scores, advice, page breaks and destination link. In the creator’s response reporting, inspect Result email delivery and select Refresh delivery. Queued means waiting; accepted means the provider received it; delivered means the recipient mail server accepted it. None proves inbox placement. Check both Inbox and Junk in your own test mailbox."
      },
      {
        "title": "If the expected option is missing",
        "body": "First confirm you completed a published quiz rather than editor Preview. Create the private result link before looking for Email your result. If email is still absent, delivery may not be configured for the environment; changing the subject will not connect the provider. Record the visible state and approximate test time for the operator, without sharing the private link or recipient details in AI chat. Private links last 30 days after completion, and anyone holding one can view its report."
      }
    ]
  },
  {
    "slug": "integrations",
    "category": "Connections",
    "title": "Connect a CRM or webhook",
    "summary": "Connecting an account is only the first check.",
    "sections": [
      {
        "title": "Availability",
        "body": "Some connectors are in pilot and require provider configuration and authorization. The presence of a logo does not establish that a connection is ready. Follow the status and setup requirements in Integrate."
      },
      {
        "title": "Configure and test",
        "body": "Choose the provider, authorize your account where supported, map the fields and run a test. Verify the contact and expected values in the destination system before enabling a live workflow. Existing contacts are not automatically backfilled."
      },
      {
        "title": "If connection fails",
        "body": "Record the provider name, time, stage and visible error. Never share API keys or tokens in chat. GoHighLevel, webhooks and Nango-based providers have different setup requirements. An authorization screen alone does not prove end-to-end delivery."
      }
    ]
  },
  {
    "slug": "marketing",
    "category": "Build your quiz",
    "title": "What belongs in the Marketing tab?",
    "summary": "Add advanced conversion features after the essentials.",
    "sections": [
      {
        "title": "Start with the quiz",
        "body": "First write questions, define the result, preview and publish. You do not need to configure every advanced feature to create a useful quiz."
      },
      {
        "title": "Make the next step relevant",
        "body": "Use the marketing controls that support your specific goal: a recommendation, a segment, a scorecard or a clear action. Explain what the visitor gains rather than adding pressure."
      },
      {
        "title": "Measure responsibly",
        "body": "Test the visitor path and consent settings before enabling tracking. Compare completions and meaningful next actions. Avoid interpreting a tiny sample or a tracked click as proof of revenue."
      }
    ]
  },
  {
    "slug": "account-access",
    "category": "Account and publishing",
    "title": "Sign-up, confirmation and password recovery",
    "summary": "Recover access without losing your draft.",
    "sections": [
      {
        "title": "Create an account",
        "body": "Use a valid email address and complete the account form. If confirmation is required, check Inbox and Junk and use the newest confirmation email. Keep your draft tab open until it is saved to the account."
      },
      {
        "title": "Reset a password",
        "body": "Use the password recovery option on the login page. Open the newest reset message and complete the reset flow. Old links may expire or already have been used."
      },
      {
        "title": "Still blocked",
        "body": "Check the address spelling and avoid repeated requests. Describe the error and approximate time to support, without including your password, reset link or access token. The AI assistant cannot confirm your account or reset your password."
      }
    ]
  },
  {
    "slug": "troubleshooting",
    "category": "Troubleshooting",
    "title": "A practical launch checklist",
    "summary": "Check the whole experience before inviting customers.",
    "sections": [
      {
        "title": "As the creator",
        "body": "Save, reload and confirm edits persist. Check scoring and page grouping. Publish and verify the public link. Keep a copy of your intended result settings."
      },
      {
        "title": "As a visitor",
        "body": "Test desktop and mobile, required fields, Back navigation, all important branches, lead capture, final action and the embed. Use synthetic answers and your own test contact."
      },
      {
        "title": "As the owner",
        "body": "Verify the response and contact are saved, reports update, and configured result emails and PDFs work. Test each integration in its destination. Note reproducible steps and expected versus actual behavior for any issue."
      }
    ]
  },
  {
    "slug": "forms-or-cards",
    "category": "Build your quiz",
    "title": "Choose Form or Cards",
    "summary": "Two presentation styles for different jobs.",
    "sections": [
      {
        "title": "Choose the presentation that fits the job",
        "body": "Use Cards for a conversational quiz: one question at a time, with the visitor focused on one answer. Use Form when related fields should appear together, such as first name, last name and email. Form can still have several pages; it does not require a single long page."
      },
      {
        "title": "Find the control",
        "body": "In the full editor, look above the page tabs for How visitors see your questions. Choose Cards · One question at a time or Form · Fields together by page. In Form, select a field and set its Page to group it with other fields. Changing presentation does not replace your questions."
      },
      {
        "title": "How Cards advances",
        "body": "A valid single-choice selection advances automatically after a short pause. Text, email, multi-select and other fields use Next so visitors can finish their answer. Immediate graded feedback pauses advancement so the explanation can be read. Back allows earlier answers to be changed, and the path is resolved again from those answers."
      },
      {
        "title": "Understand the last answer",
        "body": "If review is enabled, the visitor can review before final submission. If review is disabled, selecting the last single-choice answer can submit the quiz; the player explains this. Test the final card deliberately rather than assuming every quiz ends with a separate submit button."
      },
      {
        "title": "How Form advances",
        "body": "Next validates the visible fields on the current page together. It does not auto-advance after one choice when other fields on that page still need answers. Branching can hide fields or change the next page. Test each branch, required-field validation and Back navigation."
      },
      {
        "title": "Publish the new layout",
        "body": "Preview on desktop and mobile, wait for Saved, then Publish. Visit the public Share link to check the published version. If the old arrangement remains, confirm the fields share a Page and that the latest draft was published."
      }
    ]
  },
  {
    "slug": "answer-points-example",
    "category": "Scoring and results",
    "title": "Worked example: different points per answer",
    "summary": "Check that scores change for the right reason.",
    "sections": [
      {
        "title": "Define a useful scale",
        "body": "For “How often do you review your plan?”, use Not yet = 0, Sometimes = 5, and Every week = 10. This example measures frequency; it is not an objectively correct-answer test."
      },
      {
        "title": "Configure the appropriate model",
        "body": "Open the selected question’s scoring controls. Use the answer-level scoring for your chosen scoring model. For category-based scorecards, assign the answer weights to the intended category. Correct-answer grading is a different model; avoid treating preference questions as right or wrong."
      },
      {
        "title": "Test literal expectations",
        "body": "With only this scored question, verify the lowest answer produces the lowest score and the highest produces the highest. With several questions, check the total and normalized percentage separately. Required, skipped and unknown answers can affect how the result is calculated."
      },
      {
        "title": "If scores look identical",
        "body": "Check that answer weights really differ, that the question contributes to the intended category, and that result thresholds distinguish the resulting scores. Two different scores can legitimately fall in the same result band. Save and publish before retesting the public version."
      }
    ]
  },
  {
    "slug": "report-design",
    "category": "Design",
    "title": "Customize the downloadable report",
    "summary": "Use the report controls rather than only changing the quiz theme.",
    "sections": [
      {
        "title": "Choose a style",
        "body": "In report design, choose Editorial for open spacing and accent rules, or Executive for a dark masthead and shaded score panels. Enable Add a separate cover page to the PDF if the report needs its own cover."
      },
      {
        "title": "Write the introduction",
        "body": "Edit Report title, Report subtitle, Opening introduction and Closing footer note. A blank report title uses the saved quiz title. Keep the introduction useful to the recipient and avoid repeating every result paragraph."
      },
      {
        "title": "Arrange supporting sections",
        "body": "Toggle and reorder the available supporting sections with the up/down controls. The result summary, scores, category guidance and missing-information notices remain. Optional sections appear only when a particular result contains them. A custom report button can override the saved result button, but not buttons inside additional result sections."
      },
      {
        "title": "Apply and verify",
        "body": "Select Apply report design. Merely editing the panel is not the same as applying it. Save and publish the quiz, generate a synthetic result, download its PDF and check page breaks, long text and links. Check more than one outcome."
      },
      {
        "title": "Find and apply the controls",
        "body": "In the guided editor, open the results step and expand Report design. The full editor also includes Report design alongside the result email copy controls in Quiz Completion & Outcomes. Edit the fields, review the sample, and select Apply report design. Wait for Saved and then Publish. Unapplied settings are not included in the saved quiz."
      },
      {
        "title": "Example: a concise executive assessment",
        "body": "Choose Executive, enable a cover only if you want a separate introduction page, write a title such as Your readiness report and a short introduction explaining the assessment. Include the score/category information and practical next steps relevant to your quiz. Set a helpful call-to-action label and a valid destination. Avoid including sections that the quiz cannot populate."
      },
      {
        "title": "Understand the preview and existing reports",
        "body": "The sample preview uses fixed example data; it is not a participant record and is not an exact PDF pagination preview. Complete a fresh published quiz and download the actual report to check long text and page breaks. Existing responses retain their original report settings, so a previously created report is not a valid test of the new design."
      },
      {
        "title": "Troubleshoot PDF differences",
        "body": "The native PDF uses bundled fonts and readable accent colors. Logos, images and videos stay online. Some writing systems require Print / Save as PDF. Check both the saved online result and the downloaded file before assuming the report design failed. If Apply is disabled, correct the visible validation errors or resolve stale settings using the panel’s available reload/discard controls."
      }
    ]
  },
  {
    "slug": "conditional-results",
    "category": "Scoring and results",
    "title": "Show different content for different results",
    "summary": "Add relevant sections without making every report identical.",
    "sections": [
      {
        "title": "Choose a section",
        "body": "Use result sections to add the available content, image, video, FAQ, testimonial or action sections. Give each section a clear purpose. Use customer quotes only with permission."
      },
      {
        "title": "Set when it appears",
        "body": "Use the section condition to show it for the intended result or within a score range. For score conditions, choose the overall score or a category and enter minimum and maximum percentages. Both endpoints are included."
      },
      {
        "title": "Example",
        "body": "A score range of 0–39 can show a foundation-building explanation, while a higher range can offer more advanced steps. Make sure ranges do not accidentally overlap if you want mutually exclusive advice. Sections can be hidden when there are not enough scored answers."
      },
      {
        "title": "Verify",
        "body": "Preview or generate outcomes on both sides of each boundary. Check that the intended content and destination links appear, and that people with missing information do not receive unsupported conclusions."
      }
    ]
  },
  {
    "slug": "email-troubleshooting",
    "category": "Troubleshooting",
    "title": "Result email missing or in Junk",
    "summary": "Diagnose the stage that failed.",
    "sections": [
      {
        "title": "Confirm the right event",
        "body": "An account-confirmation email, password-reset email and quiz-result email are different flows. Record which one is missing and the approximate time. For a result email, first confirm a published response and usable contact email were captured."
      },
      {
        "title": "Check the available evidence",
        "body": "Look at the result delivery status and your test inbox, including Junk. A queued message is not a delivered message; a provider delivery event still does not prove inbox placement. Do not repeatedly submit customer addresses while diagnosing."
      },
      {
        "title": "If it is in Junk",
        "body": "Moving your own test message to Inbox may improve your experience but does not prove delivery is fixed for everyone. The operator needs the actual message’s authentication results and sending-provider evidence to investigate domain alignment or reputation. Do not change DNS blindly based only on a missing root-domain SPF record."
      },
      {
        "title": "What to report",
        "body": "Share the flow, time, inbox provider and visible error with your product administrator. Keep passwords, API keys, reset links and customer answers out of chat. The AI assistant cannot read your inbox, inspect server logs or resend a message."
      },
      {
        "title": "Start by identifying which email is missing",
        "body": "An account-confirmation message, password-reset message and requested quiz-result email are different workflows. For a result email, completing a quiz or collecting an email answer is not the same as requesting delivery. Complete the published quiz, create the private result link, and use Email my result with the separate consent checkbox."
      },
      {
        "title": "Use the visible status to narrow the problem",
        "body": "For quiz results, check Result email delivery and Refresh delivery in creator reporting. No request suggests the respondent may not have completed the request flow. Queued or sending means processing is incomplete; accepted means the provider accepted the message; delivered means the destination server accepted it. Bounced, failed or delayed states need their own investigation. Record the visible status and approximate time without sharing private links in chat."
      },
      {
        "title": "If it is in Junk",
        "body": "Check a fresh test message, not only an older one. An operator should inspect authentication results on that actual message and compare them with the sending provider’s configured domain. Missing SPF on a root domain alone is not a diagnosis; the sender may use a subdomain. The AI assistant cannot inspect headers, provider logs or DNS on your behalf. Moving your own message out of Junk does not establish a fix for other recipients."
      },
      {
        "title": "What to report if it still fails",
        "body": "Provide the affected workflow, public page type, approximate time, visible error/status, and whether a fresh message reached Inbox, Junk or neither. Do not provide your password, API key, reset URL, private report link or customer addresses to the AI assistant. Avoid repeated sends while investigating: a second accepted request does not explain the first failure."
      }
    ]
  },
  {
    "slug": "preview-vs-live",
    "category": "Account and publishing",
    "title": "Preview, Saved and Published mean different things",
    "summary": "Make sure you are testing the intended version.",
    "sections": [
      {
        "title": "Saved",
        "body": "Saved means the editor has acknowledged saving the draft. A guest browser backup is different and is tied to that device. Keep the tab open if saving fails."
      },
      {
        "title": "Preview",
        "body": "Preview is for checking the draft experience. It is not the public share link and is not evidence that real visitor responses, analytics, email or integrations work in production."
      },
      {
        "title": "Published",
        "body": "Publishing makes the saved release available through its public link. Later edits may remain unpublished until you publish again. Read the publication status and wait for confirmation before sharing."
      },
      {
        "title": "Practical check",
        "body": "Change a test title, save and preview it. Publish, then open the public link separately to confirm the title. Submit synthetic data and check Results. If preview works but sharing fails, start with publication status and the public URL."
      }
    ]
  },
  {
    "slug": "unavailable-link",
    "category": "Troubleshooting",
    "title": "A shared quiz shows unavailable or 404",
    "summary": "Check publication before changing the embed.",
    "sections": [
      {
        "title": "Check the URL",
        "body": "Open Share and copy the public player link. Do not send the editor link, a preview link or a local development address. Check that copying did not omit part of the address."
      },
      {
        "title": "Check publication",
        "body": "Confirm the quiz is published and not paused. Wait for a clear publication confirmation. Save status alone does not mean the quiz is public."
      },
      {
        "title": "Separate website and quiz issues",
        "body": "Open the direct public link outside the embed. If it works there, check the host website’s iframe block, copied source and dimensions. If it fails directly as well, investigate the quiz’s publication or server availability first."
      },
      {
        "title": "Report a reproducible problem",
        "body": "Record the time, whether the direct link and embed differ, the visible message and browser. Share identifiers only through your established support channel, and never include private result tokens in the AI chat."
      }
    ]
  },
  {
    "slug": "first-test-plan",
    "category": "Start here",
    "title": "Run your first complete test",
    "summary": "A repeatable rehearsal before sending traffic.",
    "sections": [
      {
        "title": "Prepare synthetic data",
        "body": "Use a short quiz and made-up answers. Use only your own test address when testing an email. Decide the expected score and result in advance so you can compare them with the actual outcome."
      },
      {
        "title": "Walk through as a visitor",
        "body": "Open the published link. Check required fields, Form or Cards behavior, Back navigation, branches, lead capture and the result action. Repeat on mobile and in the host website if embedded."
      },
      {
        "title": "Check the owner side",
        "body": "Confirm the saved response and any captured contact. Check analytics for the appropriate live activity. Download the report and verify any configured email or destination contact separately."
      },
      {
        "title": "Record the outcome",
        "body": "Write down expected versus actual behavior and the exact steps to reproduce a failure. One successful path does not establish that all branches work; repeat low/high scores, changed answers and skipped optional fields."
      }
    ]
  },
  {
    "slug": "support-assistant",
    "category": "Troubleshooting",
    "title": "Using Pippi AI support",
    "summary": "Understand what the chat can and cannot do.",
    "sections": [
      {
        "title": "Open a conversation",
        "body": "Choose Ask Pippi at the bottom left of a Pippi product page. Describe what you are trying to do and the section you are using. Minimize to return to your work, then reopen to continue. Escape also closes the panel."
      },
      {
        "title": "Use the guides",
        "body": "The assistant uses the published Pippi guide and links to its source articles. Follow those links to read the complete steps. Guides are public; AI chat requires sign-in. If AI is unavailable, use search and the suggested articles."
      },
      {
        "title": "Protect your information",
        "body": "The question and recent conversation are sent to Google to generate an answer. Do not include passwords, API keys, recovery links or customer details. Chat is kept in page memory and clears on reload; it is not a support-ticket archive."
      },
      {
        "title": "Know the limits",
        "body": "This is AI, not a live employee. It cannot inspect your account, make changes, create a ticket, verify email delivery or promise a response from a person. If the documentation is insufficient, treat the answer as incomplete and use your established contact with the product team."
      }
    ]
  },
  {
    "slug": "quiz-copy",
    "category": "Build your quiz",
    "title": "Write questions that earn the next step",
    "summary": "Make the experience relevant without pressure.",
    "sections": [
      {
        "title": "Start with the visitor’s goal",
        "body": "Ask what they want to accomplish in their own terms. Follow with their current situation, constraints and preferences. Each answer should improve the result or recommendation."
      },
      {
        "title": "Keep choices honest",
        "body": "Give distinct alternatives, including an appropriate not-sure or not-applicable option. Avoid implying that every visitor has the same problem or is ready to buy. Do not score uncertain answers as confident evidence."
      },
      {
        "title": "Connect the result to the answers",
        "body": "Explain why the recommendation fits, include practical advice and offer a relevant next action. Avoid promises you cannot support or disguising a sales offer as an independent diagnosis."
      },
      {
        "title": "Test comprehension",
        "body": "Ask a new person to build and complete the quiz without coaching. Note unclear questions and moments where they cannot find the next action. Use feedback and actual completion evidence rather than assuming persuasive wording improves conversion."
      }
    ]
  }
];
const stopWords = new Set(["how", "can", "could", "would", "should", "the", "and", "for", "with", "that", "this", "what", "why", "does", "are", "have", "has", "get", "want", "please", "pippi", "help", "put", "one", "use", "into", "your", "their"]);
export function searchHelp(query: string): HelpArticle[] {
  const words = [...new Set(query.toLowerCase().match(/[a-z0-9]+/g)?.filter(w => w.length > 2 && !stopWords.has(w)) || [])];
  if (!words.length) return helpArticles;
  const normalize = (s:string) => s.toLowerCase().replace(/s\b/g, "");
  return helpArticles.map(article => {
    const title=normalize(article.title), summary=normalize(article.summary), body=normalize(article.sections.map(s=>s.title+" "+s.body).join(" "));
    let score = words.reduce((total,word) => { const term=normalize(word); return total + (title.includes(term)?8:0) + (summary.includes(term)?4:0) + (body.includes(term)?1:0); },0);
    // Common builder vocabulary should surface the actual setup guides first.
    if (/\b(fields?|pages?|slides?|cards?|forms?)\b/i.test(query) && ["pages-and-fields","forms-or-cards"].includes(article.slug)) score += 12;
    return {article,score};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).map(item=>item.article);
}
