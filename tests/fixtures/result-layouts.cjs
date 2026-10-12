const { marketingTemplate } = require('../../lib/marketing-templates.ts');
const { MarketingSchema } = require('../../lib/marketing.ts');
function scorecardForm(id, layout='stacked') {
  const form=marketingTemplate('scorecard',id);
  form.title='Your practical growth scorecard';
  form.marketing=MarketingSchema.parse({...form.marketing,
    presentation:{layout},
    scorecard:{title:'Your practical growth scorecard',message:'A useful next step based on the practices you reported.',bands:[
      {id:'foundation',min:0,max:69,title:'Make one useful improvement',advice:'Start with one owner for every inquiry.',ctaLabel:'Explore your next step',ctaUrl:'https://example.com/layout-next-step'},
      {id:'progress',min:70,max:100,title:'Build on your progress',advice:'Keep reviewing which practices help your team.',ctaLabel:'Explore your next step',ctaUrl:'https://example.com/layout-next-step'},
    ]},
    categories:form.marketing.categories.map(category=>({...category,bands:[
      {id:'focus',min:0,max:49,title:'Needs attention',advice:'Make this area easier to repeat.',action:`Choose one documented step for ${category.title}.`},
      {id:'keep',min:50,max:100,title:'Keep improving',advice:'Check that the routine stays useful.',action:`Review the routine for ${category.title}.`},
    ]})),
    resultSections:[
      {id:'always',type:'text',title:'How to use this result',body:'Use this as a conversation starter, not a prediction.'},
      {id:'low',type:'text',title:'A focused starting point',body:'Pick one routine to improve this week.',condition:{type:'score',min:0,max:60}},
      {id:'high',type:'text',title:'Build on your habits',body:'Keep the useful routines visible to your team.',condition:{type:'score',min:61,max:100}},
      {id:'followup',type:'cta',title:'Keep exploring',url:'https://example.com/layout-details',label:'See the practical guide'},
    ],
  });
  return form;
}
module.exports={scorecardForm};
