const width = 960;
const height = 600;

//WORLD MAP START

const fmt = (v, type) => {
  if (v === "" || v == null || isNaN(v)) return "No data";

  if (type === "gdp" || type === "urban") {
    return Math.round(v);
  }

  return v;
};

const tooltip = d3.select("#tooltip");

Promise.all([
  d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
  d3.csv("data/data.csv")
]).then(([world, data]) => {

  data.forEach(d => {
    d.year = +d.year;
    d.iso3 = (d.iso3 || "").trim().toUpperCase();

    d.fertility = d.fertility === "" ? null : +d.fertility;
    d.gdp = d.gdp === "" ? null : +d.gdp;
    d.urban = d.urban === "" ? null : +d.urban;
    d.education = d.education === "" ? null : +d.education;
  });

  const dataByIsoYear = d3.group(
    data,
    d => d.iso3,
    d => d.year
  );

  const fertilityExtent = d3.extent(
    data.filter(d => d.fertility != null),
    d => d.fertility
  );

  const colorScale = d3.scaleSequential()
    .domain(fertilityExtent)
    .interpolator(d3.interpolatePlasma);

  const svg = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("border", "2px solid black");

  const projection = d3.geoNaturalEarth1()
    .scale(160)
    .translate([width / 2, height / 2]);

  const path = d3.geoPath().projection(projection);

  const countries = world.features;

  const g = svg.append("g");

  const paths = g.selectAll("path")
    .data(countries)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("stroke", "#999")
    .attr("stroke-width", 0.5);

  const years = Array.from(new Set(data.map(d => d.year)))
    .sort((a, b) => a - b);

  const slider = d3.select("#yearSlider")
    .attr("min", d3.min(years))
    .attr("max", d3.max(years))
    .attr("step", 1)
    .property("value", d3.max(years));

  const yearLabel = d3.select("#yearLabel");

  function update(year) {

    year = +year;
    yearLabel.text(year);

    paths.transition()
      .duration(300)
      .attr("fill", d => {

        const iso = (d.id || "")
          .toString()
          .trim()
          .toUpperCase();

        const row = dataByIsoYear.get(iso)?.get(year)?.[0];

        return row?.fertility != null
          ? colorScale(row.fertility)
          : "#ccc";
      });
  }

  update(slider.property("value"));

  slider.on("input", function () {
    update(this.value);
  });

  paths
    .on("mouseover", function(event, d) {

      const year = +slider.property("value");
      const iso = (d.id || "").toString().trim().toUpperCase();

      const row = dataByIsoYear.get(iso)?.get(year)?.[0];

      d3.select(this)
        .attr("stroke", "#000")
        .attr("stroke-width", 1.5);

      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${fmt(d.properties.name)}</strong><br/>
          Fertility: ${fmt(row?.fertility)}<br/>
          GDP: ${fmt(row?.gdp, "gdp")}<br/>
          Urban: ${fmt(row?.urban, "urban")}<br/>
          Education: ${fmt(row?.education)}
        `);
    })

    .on("mousemove", function(event) {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px");
    })

    .on("mouseout", function() {
      d3.select(this)
        .attr("stroke", "#999")
        .attr("stroke-width", 0.5);

      tooltip.style("opacity", 0);
    });

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg.call(zoom);

});

//WORLD MAP END


// LIFESTYLE ANALYSIS (independent from map)
(() => {
  const lifestyleRegions = new Set([
    "East Asia & Pacific",
    "Europe & Central Asia",
    "Latin America & Caribbean",
    "Middle East, North Africa, Afghanistan & Pakistan",
    "North America",
    "South Asia",
    "Sub-Saharan Africa"
  ]);

  const lifestyleYearLabel = d3.select("#lifestyle-year-label");
  const playBtn = d3.select("#lifestyle-play");
  const restartBtn = d3.select("#lifestyle-restart");

  const chartWrap = d3.select("#lifestyle-chart");

  const margin = { top: 30, right: 30, bottom: 55, left: 70 };
  const chartWidth = 960;
  const chartHeight = 520;
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const svg = chartWrap
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, 100]).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, 8]).range([innerHeight, 0]);

  const xAxisG = g
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`);
  const yAxisG = g.append("g");

  xAxisG
    .append("text")
    .attr("x", innerWidth / 2)
    .attr("y", 42)
    .attr("fill", "#111")
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .text("Internet penetration (% of population)");

  yAxisG
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -52)
    .attr("fill", "#111")
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .text("Fertility rate (births per woman)");

  const backdrop = g.append("g").attr("pointer-events", "none");
  backdrop
    .append("text")
    .attr("x", 10)
    .attr("y", 26)
    .attr("fill", "#888")
    .attr("font-size", 22)
    .attr("font-weight", 700)
    .attr("opacity", 0.18)
    .text("Traditional");

  backdrop
    .append("text")
    .attr("x", innerWidth - 10)
    .attr("y", innerHeight - 12)
    .attr("fill", "#888")
    .attr("font-size", 22)
    .attr("font-weight", 700)
    .attr("opacity", 0.18)
    .attr("text-anchor", "end")
    .text("Digital Modernity");

  const benchmarkG = g.append("g").attr("pointer-events", "none");
  const worldVLine = benchmarkG
    .append("line")
    .attr("stroke", "#888")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "6,6")
    .attr("y1", 0)
    .attr("y2", innerHeight);

  const worldHLine = benchmarkG
    .append("line")
    .attr("stroke", "#888")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "6,6")
    .attr("x1", 0)
    .attr("x2", innerWidth);

  const bubblesG = g.append("g");

  // WDI-style CSVs have metadata lines above the real header.
  async function loadWdiLikeCsv(path) {
    const text = await fetch(path).then(r => r.text());
    const lines = text.split(/\r?\n/);
    const headerIdx = lines.findIndex(l => l.startsWith('"Country Name"'));
    if (headerIdx === -1) {
      throw new Error(`Could not find WDI header in ${path}`);
    }
    const cleaned = lines.slice(headerIdx).join("\n");
    return d3.csvParse(cleaned);
  }

  function getYearValue(row, year) {
    if (!row) return null;
    const v = row[String(year)];
    if (v == null || v === "") return null;
    const n = +v;
    return Number.isFinite(n) ? n : null;
  }

  function byCountryName(rows) {
    const m = new Map();
    for (const r of rows) {
      const name = (r["Country Name"] || "").trim();
      if (name) m.set(name, r);
    }
    return m;
  }

  Promise.all([
    loadWdiLikeCsv("data/internet_pen.csv"),
    loadWdiLikeCsv("data/fertility.csv"),
    loadWdiLikeCsv("data/total_population.csv"),
    loadWdiLikeCsv("data/Urban_Data.csv")
  ]).then(([internetRows, fertilityRows, popRows, urbanRows]) => {
    const internetByName = byCountryName(internetRows);
    const fertilityByName = byCountryName(fertilityRows);
    const popByName = byCountryName(popRows);
    const urbanByName = byCountryName(urbanRows);

    const color = d3
      .scaleSequential()
      .domain([0, 100])
      .interpolator(d3.interpolateYlGnBu);

    xAxisG.call(d3.axisBottom(x).ticks(6));
    yAxisG.call(d3.axisLeft(y).ticks(6));

    const minYear = 2005;
    const maxYear = 2024;
    let currentYear = minYear;
    let timer = null;

    function updateLifestyleChart(year) {
      year = +year;
      lifestyleYearLabel.text(year);

      const regions = Array.from(lifestyleRegions);
      const points = regions
        .map(region => {
          const internet = getYearValue(internetByName.get(region), year);
          const fertility = getYearValue(fertilityByName.get(region), year);
          const pop = getYearValue(popByName.get(region), year);
          const urban = getYearValue(urbanByName.get(region), year);

          return {
            region,
            internet,
            fertility,
            pop,
            urban
          };
        })
        .filter(d => d.internet != null && d.fertility != null && d.pop != null && d.urban != null);

      const worldInternet = getYearValue(internetByName.get("World"), year);
      const worldFertility = getYearValue(fertilityByName.get("World"), year);

      const popExtent = d3.extent(points, d => d.pop);
      const r = d3
        .scaleSqrt()
        .domain([Math.max(1, popExtent[0] || 1), popExtent[1] || 1])
        .range([14, 46]);

      const circles = bubblesG.selectAll("circle").data(points, d => d.region);

      circles
        .enter()
        .append("circle")
        .attr("cx", d => x(d.internet))
        .attr("cy", d => y(d.fertility))
        .attr("r", d => r(d.pop))
        .attr("fill", d => color(d.urban))
        .attr("opacity", 0.9)
        .attr("stroke", "#17324a")
        .attr("stroke-opacity", 0.35)
        .attr("stroke-width", 1)
        .merge(circles)
        .transition()
        .duration(350)
        .attr("cx", d => x(d.internet))
        .attr("cy", d => y(d.fertility))
        .attr("r", d => r(d.pop))
        .attr("fill", d => color(d.urban));

      circles.exit().transition().duration(200).attr("r", 0).remove();

      // World benchmark lines
      if (worldInternet != null && worldFertility != null) {
        worldVLine
          .style("display", null)
          .transition()
          .duration(250)
          .attr("x1", x(worldInternet))
          .attr("x2", x(worldInternet));

        worldHLine
          .style("display", null)
          .transition()
          .duration(250)
          .attr("y1", y(worldFertility))
          .attr("y2", y(worldFertility));
      } else {
        worldVLine.style("display", "none");
        worldHLine.style("display", "none");
      }
    }

    // Expose per requirement (and useful for debugging)
    window.updateLifestyleChart = updateLifestyleChart;

    function setPlaying(isPlaying) {
      playBtn.property("disabled", isPlaying);
      restartBtn.property("disabled", false);
    }

    function stopTimer() {
      if (timer) {
        timer.stop();
        timer = null;
      }
      setPlaying(false);
    }

    function startPlayback() {
      if (timer) return;

      if (currentYear > maxYear) currentYear = minYear;
      setPlaying(true);

      // Advance immediately so "Play" feels responsive.
      updateLifestyleChart(currentYear);

      timer = d3.interval(() => {
        if (currentYear >= maxYear) {
          stopTimer();
          return;
        }
        currentYear += 1;
        updateLifestyleChart(currentYear);
      }, 650);
    }

    function restart() {
      stopTimer();
      currentYear = minYear;
      updateLifestyleChart(currentYear);
    }

    // Initial state
    restartBtn.property("disabled", false);
    setPlaying(false);
    updateLifestyleChart(currentYear);

    playBtn.on("click", () => startPlayback());
    restartBtn.on("click", () => restart());
  });
})();