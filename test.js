import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function describe(label, v) {
  console.log(label, "type:", typeof v, "value:", v);
  if (v && typeof v === "object") {
    console.log(label, "keys:", Object.keys(v));
  }
}

async function main() {
  const q = await yahooFinance.quoteSummary("BTC-USD", {
    modules: ["price", "summaryDetail"]
  });

  const mc1 = q?.price?.marketCap;
  const mc2 = q?.summaryDetail?.marketCap;

  describe("price.marketCap", mc1);
  describe("summaryDetail.marketCap", mc2);

  // robust extractor: handles number OR {raw,fmt} OR {longFmt,shortFmt}
  const marketCap =
    (typeof mc1 === "number" ? mc1 : mc1?.raw ?? mc1?.longFmt ?? mc1?.fmt) ??
    (typeof mc2 === "number" ? mc2 : mc2?.raw ?? mc2?.longFmt ?? mc2?.fmt);

  console.log("EXTRACTED marketCap:", marketCap);

  // also show circulating supply (useful if we need to compute market cap ourselves)
  describe("price.circulatingSupply", q?.price?.circulatingSupply);
  describe("summaryDetail.circulatingSupply", q?.summaryDetail?.circulatingSupply);
}

main().catch(console.error);
