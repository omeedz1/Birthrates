

const width = 960;
const height = 600;
const introWidth = 960;
const introHeight = 520;

const introWrap = d3.select("#intro-vis");

const introControls = introWrap
  .append("div")
  .attr("class", "intro-map-controls");

introControls
  .append("label")
  .html('Year: <input type="range" id="intro-year-slider" step="1"> <span id="intro-year-label"></span>');

introControls
  .append("span")
  .attr("class", "intro-map-help")
  .text("Drag to rotate, scroll to zoom");

const introSvg = introWrap
  .append("svg")
  .attr("width", introWidth)
  .attr("height", introHeight)
  .attr("viewBox", `0 0 ${introWidth} ${introHeight}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "intro-tooltip");

Promise.all([
  d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
  d3.csv("data/data.csv")
]).then(([world, data]) => {
  data.forEach(d => {
    d.year = +d.year;
    d.iso3 = (d.iso3 || "").trim().toUpperCase();
    d.fertility = d.fertility === "" ? null : +d.fertility;
  });

  const validData = data.filter(d => d.iso3 && d.year != null && d.fertility != null);
  const dataByIsoYear = d3.group(validData, d => d.iso3, d => d.year);
  const years = Array.from(new Set(validData.map(d => d.year))).sort((a, b) => a - b);
  const fertilityExtent = d3.extent(validData, d => d.fertility);
  const baselineYear = 1990;

  const colorScale = d3.scaleSequential()
    .domain(fertilityExtent)
    .interpolator(d3.interpolateBlues);

  const latestYear = d3.max(years);
  const countryChanges = world.features.map(feature => {
    const iso = (feature.id || "").toString().trim().toUpperCase();
    const baseline = dataByIsoYear.get(iso)?.get(baselineYear)?.[0]?.fertility;
    const latest = dataByIsoYear.get(iso)?.get(latestYear)?.[0]?.fertility;

    return {
      feature,
      iso,
      name: feature.properties.name,
      centroid: d3.geoCentroid(feature),
      baseline,
      latest,
      maxAbsChange: baseline == null || latest == null ? null : Math.abs(latest - baseline)
    };
  });

  const changeLengthScale = d3.scaleSqrt()
    .domain([0, d3.max(countryChanges, d => d.maxAbsChange) || 1])
    .range([7, 38]);

  const baseGlobeScale = 220;
  const projection = d3.geoOrthographic()
    .scale(baseGlobeScale)
    .translate([introWidth / 2, introHeight / 2 + 28])
    .clipAngle(90)
    .precision(0.5)
    .rotate([-10, -15, 0]);

  const path = d3.geoPath().projection(projection);

  const mapG = introSvg.append("g");
  const graticule = d3.geoGraticule10();
  const defs = introSvg.append("defs");

  const sphere = mapG.append("path")
    .datum({ type: "Sphere" })
    .attr("fill", "#f8fafc")
    .attr("stroke", "#cbd5e1")
    .attr("stroke-width", 1.2);

  const graticulePath = mapG.append("path")
    .datum(graticule)
    .attr("fill", "none")
    .attr("stroke", "#dbe3ea")
    .attr("stroke-width", 0.6)
    .attr("stroke-opacity", 0.7)
    .attr("pointer-events", "none");

  const countries = mapG.selectAll("path.intro-country")
    .data(world.features)
    .enter()
    .append("path")
    .attr("class", "intro-country")
    .attr("d", path)
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.45)
    .attr("fill", "#d8dee6");

  const changeMarkers = mapG.append("g")
    .attr("class", "intro-change-markers")
    .attr("pointer-events", "none")
    .selectAll("g")
    .data(countryChanges)
    .enter()
    .append("g")
    .attr("opacity", 0);

  changeMarkers.append("line")
    .attr("stroke-width", 2.6)
    .attr("stroke-linecap", "round");

  changeMarkers.append("path")
    .attr("class", "intro-change-arrowhead");

  function redrawIntroGlobe() {
    sphere.attr("d", path);
    graticulePath.attr("d", path);
    countries.attr("d", path);
    updateChangeMarkers(changeMarkers, currentIntroYear);
  }

  const legendWidth = 210;
  const legendHeight = 10;
  const legendX = introWidth - legendWidth - 28;
  const legendY = 28;
  const gradient = defs.append("linearGradient")
    .attr("id", "intro-fertility-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  d3.range(0, 1.01, 0.1).forEach(t => {
    gradient.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", colorScale(fertilityExtent[0] + t * (fertilityExtent[1] - fertilityExtent[0])));
  });

  const legend = introSvg.append("g")
    .attr("transform", `translate(${legendX},${legendY})`);

  const introLegendX = d3.scaleLinear()
    .domain(fertilityExtent)
    .range([0, legendWidth])
    .clamp(true);

  legend.append("text")
    .attr("x", 0)
    .attr("y", -8)
    .attr("fill", "#334155")
    .attr("font-size", 11)
    .attr("font-weight", 700)
    .text("Fertility rate");

  legend.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#intro-fertility-gradient)");

  legend.append("text")
    .attr("x", 0)
    .attr("y", 26)
    .attr("fill", "#334155")
    .attr("font-size", 10)
    .text(d3.format(".1f")(fertilityExtent[0]));

  legend.append("text")
    .attr("x", legendWidth)
    .attr("y", 26)
    .attr("fill", "#334155")
    .attr("font-size", 10)
    .attr("text-anchor", "end")
    .text(d3.format(".1f")(fertilityExtent[1]));

  const introLegendPointer = legend.append("line")
    .attr("y1", -3)
    .attr("y2", legendHeight + 3)
    .attr("stroke", "#111827")
    .attr("stroke-width", 2)
    .attr("stroke-linecap", "round")
    .attr("pointer-events", "none")
    .style("opacity", 0);

  const changeLegend = introSvg.append("g")
    .attr("transform", `translate(28,${legendY})`);

  changeLegend.append("text")
    .attr("x", 0)
    .attr("y", -8)
    .attr("fill", "#334155")
    .attr("font-size", 11)
    .attr("font-weight", 700)
    .text("Change since 1990");

  [
    { label: "Increase", color: "#15803d", y1: 20, y2: 2, head: "M6,0L0,12L12,12Z" },
    { label: "Decrease", color: "#dc2626", y1: 2, y2: 20, head: "M6,22L0,10L12,10Z" }
  ].forEach((item, index) => {
    const itemG = changeLegend.append("g")
      .attr("transform", `translate(${index * 86},0)`);

    itemG.append("line")
      .attr("x1", 6)
      .attr("y1", item.y1)
      .attr("x2", 6)
      .attr("y2", item.y2)
      .attr("stroke", item.color)
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round");

    itemG.append("path")
      .attr("d", item.head)
      .attr("fill", item.color);

    itemG.append("text")
      .attr("x", 16)
      .attr("y", 15)
      .attr("fill", "#334155")
      .attr("font-size", 10)
      .text(item.label);
  });

  const introSlider = d3.select("#intro-year-slider")
    .attr("min", d3.min(years))
    .attr("max", d3.max(years))
    .attr("step", 1)
    .property("value", d3.max(years));

  const introYearLabel = d3.select("#intro-year-label");
  let currentIntroYear = +introSlider.property("value");

  function isPointVisible(coordinates) {
    const rotate = projection.rotate();
    const center = [-rotate[0], -rotate[1]];

    return d3.geoDistance(coordinates, center) < Math.PI / 2;
  }

  function getFertilityChange(d, year) {
    const row = dataByIsoYear.get(d.iso)?.get(year)?.[0];

    return row?.fertility == null || d.baseline == null ? null : row.fertility - d.baseline;
  }

  function getChangeMarkerState(d, year) {
    const change = getFertilityChange(d, year);
    const point = projection(d.centroid);
    const visible = change != null && Math.abs(change) >= 0.02 && point && isPointVisible(d.centroid);
    const length = change == null ? 0 : changeLengthScale(Math.abs(change));

    return {
      change,
      color: change > 0 ? "#15803d" : "#dc2626",
      direction: change > 0 ? "up" : "down",
      length,
      point,
      visible
    };
  }

  function updateChangeMarkers(target, year) {
    target
      .attr("transform", d => {
        const state = getChangeMarkerState(d, year);

        return state.point ? `translate(${state.point[0]},${state.point[1]})` : "translate(0,0)";
      })
      .attr("opacity", d => {
        const state = getChangeMarkerState(d, year);

        return state.visible ? 0.9 : 0;
      });

    target.select("line")
      .attr("y1", d => {
        const state = getChangeMarkerState(d, year);

        return state.direction === "up" ? state.length / 2 : -state.length / 2;
      })
      .attr("y2", d => {
        const state = getChangeMarkerState(d, year);

        return state.direction === "up" ? -state.length / 2 + 6 : state.length / 2 - 6;
      })
      .attr("stroke", d => getChangeMarkerState(d, year).color);

    target.select("path.intro-change-arrowhead")
      .attr("d", d => {
        const state = getChangeMarkerState(d, year);

        return state.direction === "up"
          ? "M0,-4L-6,8L6,8Z"
          : "M0,4L-6,-8L6,-8Z";
      })
      .attr("transform", d => {
        const state = getChangeMarkerState(d, year);
        const y = state.direction === "up" ? -state.length / 2 : state.length / 2;

        return `translate(0,${y})`;
      })
      .attr("fill", d => getChangeMarkerState(d, year).color);
  }

  function updateIntroMap(year) {
    year = +year;
    currentIntroYear = year;
    introYearLabel.text(year);

    countries.transition()
      .duration(250)
      .attr("fill", d => {
        const iso = (d.id || "").toString().trim().toUpperCase();
        const row = dataByIsoYear.get(iso)?.get(year)?.[0];

        return row?.fertility != null ? colorScale(row.fertility) : "#d8dee6";
      });

    updateChangeMarkers(changeMarkers.transition().duration(250), year);
  }

  let dragStartRotation;
  let dragStartPointer;
  const dragBehavior = d3.drag()
    .on("start", function(event) {
      dragStartRotation = projection.rotate();
      dragStartPointer = [event.x, event.y];
    })
    .on("drag", function(event) {
      const zoomScale = projection.scale() / baseGlobeScale;
      const sensitivity = 0.35 / zoomScale;
      const dx = event.x - dragStartPointer[0];
      const dy = event.y - dragStartPointer[1];
      const nextLatitude = Math.max(-80, Math.min(80, dragStartRotation[1] - dy * sensitivity));

      projection.rotate([
        dragStartRotation[0] + dx * sensitivity,
        nextLatitude,
        dragStartRotation[2]
      ]);

      redrawIntroGlobe();
    });

  const zoomBehavior = d3.zoom()
    .scaleExtent([1, 5])
    .filter(event => event.type === "wheel")
    .on("zoom", function(event) {
      projection.scale(baseGlobeScale * event.transform.k);
      redrawIntroGlobe();
    });

  introSvg
    .call(dragBehavior)
    .call(zoomBehavior);

  countries
    .on("mouseover", function(event, d) {
      const year = currentIntroYear;
      const iso = (d.id || "").toString().trim().toUpperCase();
      const row = dataByIsoYear.get(iso)?.get(year)?.[0];

      d3.select(this)
        .attr("stroke", "#111827")
        .attr("stroke-width", 1);

      if (row?.fertility != null) {
        introLegendPointer
          .interrupt()
          .style("opacity", 1)
          .transition()
          .duration(180)
          .attr("x1", introLegendX(row.fertility))
          .attr("x2", introLegendX(row.fertility));
      } else {
        introLegendPointer
          .interrupt()
          .transition()
          .duration(120)
          .style("opacity", 0);
      }

      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.properties.name}</strong><br/>
          Year: ${year}<br/>
          Fertility: ${row?.fertility == null ? "No data" : d3.format(".2f")(row.fertility)} births per woman
        `);
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
    })
    .on("mouseout", function() {
      d3.select(this)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.45);

      tooltip.style("opacity", 0);
      introLegendPointer
        .interrupt()
        .transition()
        .duration(150)
        .style("opacity", 0);
    });

  redrawIntroGlobe();
  updateIntroMap(introSlider.property("value"));

  introSlider.on("input", function() {
    updateIntroMap(this.value);
  });
});



/*
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
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("border", "1px solid black");
    

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

*/


(() => {
  const educationYearLabel = d3.select("#education-year-label");
  const educationSlider = d3.select("#education-year-slider");
  const chartWrap = d3.select("#education-chart");

  const educationTooltip = d3
    .select("body")
    .append("div")
    .attr("class", "education-tooltip");

  const fmtEducation = d3.format(".2f");
  const fmtFertilityRate = d3.format(".2f");
  const fmtPopulation = d3.format(",");

  const margin = { top: 24, right: 24, bottom: 56, left: 64 };
  const chartWidth = 960;
  const chartHeight = 520;
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const svg = chartWrap
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

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
    .text("Female tertiary enrollment (% gross)");

  yAxisG
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -48)
    .attr("fill", "#111")
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .text("Fertility rate (births per woman)");

  const bubblesG = g.append("g");
  const correlationLabel = g.append("text")
    .attr("x", innerWidth)
    .attr("y", 10)
    .attr("text-anchor", "end")
    .attr("fill", "#334155")
    .attr("font-size", 12)
    .attr("font-weight", 600);

  const incomeLevels = [
    { code: "L", label: "Low income", shortLabel: "Low", color: "#7c3aed" },
    { code: "LM", label: "Lower-middle income", shortLabel: "Lower-mid", color: "#0f766e" },
    { code: "UM", label: "Upper-middle income", shortLabel: "Upper-mid", color: "#d97706" },
    { code: "H", label: "High income", shortLabel: "High", color: "#dc2626" },
    { code: null, label: "No classification", shortLabel: "N/A", color: "#94a3b8" }
  ];

  function getIncomeLevel(code) {
    return incomeLevels.find(level => level.code === code) || incomeLevels[incomeLevels.length - 1];
  }

  function parseIncomeClassifications(text) {
    const rows = d3.csvParseRows(text);
    const yearRow = rows.find(row => row[1] === "Data for calendar year :");
    const classifications = new Map();

    if (!yearRow) {
      return classifications;
    }

    rows.forEach(row => {
      const iso3 = row[0];

      if (!iso3 || iso3.length !== 3) {
        return;
      }

      yearRow.forEach((yearValue, index) => {
        const year = +yearValue;
        const code = row[index];

        if (Number.isFinite(year) && ["L", "LM", "UM", "H"].includes(code)) {
          classifications.set(`${iso3}-${year}`, code);
        }
      });
    });

    return classifications;
  }

  const legend = g.append("g")
    .attr("transform", `translate(${innerWidth - 820}, 10)`);

  legend.append("text")
    .attr("x", 0)
    .attr("y", 4)
    .attr("fill", "#334155")
    .attr("font-size", 11)
    .attr("font-weight", 700)
    .text("Income level");

  const legendItems = legend.selectAll("g")
    .data(incomeLevels)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(${84 + i * 76}, 0)`);

  legendItems.append("circle")
    .attr("cx", 5)
    .attr("cy", 0)
    .attr("r", 4)
    .attr("fill", d => d.color)
    .attr("fill-opacity", 0.7);

  legendItems.append("text")
    .attr("x", 13)
    .attr("y", 4)
    .attr("fill", "#334155")
    .attr("font-size", 10)
    .text(d => d.shortLabel);

  const sizeLegend = legend.append("g")
    .attr("transform", "translate(470, 0)");

  sizeLegend.append("circle")
    .attr("cx", 5)
    .attr("cy", 0)
    .attr("r", 7)
    .attr("fill", "none")
    .attr("stroke", "#334155")
    .attr("stroke-width", 1);

  sizeLegend.append("text")
    .attr("x", 18)
    .attr("y", 4)
    .attr("fill", "#334155")
    .attr("font-size", 10)
    .text("Size = population");

  Promise.all([
    d3.csv("data/data.csv"),
    d3.text("data/income_classifications.csv")
  ]).then(([data, incomeText]) => {
    const incomeClassifications = parseIncomeClassifications(incomeText);

    data.forEach(d => {
      d.year = +d.year;
      d.fertility = d.fertility === "" ? null : +d.fertility;
      d.education = d.education === "" ? null : +d.education;
      d.population = d.population === "" ? null : +d.population;
    });

    const validData = data.filter(
      d => d.year != null && d.fertility != null && d.education != null && d.population != null
    );

    const years = Array.from(new Set(validData.map(d => d.year))).sort((a, b) => a - b);

    educationSlider
      .attr("min", d3.min(years))
      .attr("max", d3.max(years))
      .attr("step", 1)
      .property("value", d3.min(years));

    const x = d3.scaleLinear()
      .domain([0, d3.max(validData, d => d.education)])
      .nice()
      .range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(validData, d => d.fertility)])
      .nice()
      .range([innerHeight, 0]);

    const size = d3.scaleSqrt()
      .domain(d3.extent(validData, d => d.population))
      .range([3, 20]);

    xAxisG.call(d3.axisBottom(x).ticks(6));
    yAxisG.call(d3.axisLeft(y).ticks(6));

    g.append("g")
      .attr("class", "grid-lines")
      .attr("stroke", "#eef3f7")
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", 0.7)
      .attr("pointer-events", "none")
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat("").ticks(6))
      .call(g => g.select(".domain").remove())
      .lower();

    g.append("g")
      .attr("class", "grid-lines")
      .attr("transform", `translate(0,${innerHeight})`)
      .attr("stroke", "#eef3f7")
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", 0.7)
      .attr("pointer-events", "none")
      .call(d3.axisBottom(x).tickSize(-innerHeight).tickFormat("").ticks(6))
      .call(g => g.select(".domain").remove())
      .lower();

    function pearsonCorrelation(values) {
      if (values.length < 2) return null;

      const meanX = d3.mean(values, d => d.education);
      const meanY = d3.mean(values, d => d.fertility);

      let numerator = 0;
      let sumSqX = 0;
      let sumSqY = 0;

      values.forEach(d => {
        const dx = d.education - meanX;
        const dy = d.fertility - meanY;
        numerator += dx * dy;
        sumSqX += dx * dx;
        sumSqY += dy * dy;
      });

      const denominator = Math.sqrt(sumSqX * sumSqY);
      return denominator ? numerator / denominator : null;
    }

    function updateEducationChart(year) {
      year = +year;
      educationYearLabel.text(year);

      const yearData = validData
        .filter(d => d.year === year)
        .map(d => ({
          ...d,
          incomeCode: incomeClassifications.get(`${d.iso3}-${year}`) || null
        }))
        .sort((a, b) => b.population - a.population);

      const correlation = pearsonCorrelation(yearData);
      correlationLabel.text(
        correlation == null
          ? "Correlation: N/A"
          : `Correlation (r): ${d3.format(".2f")(correlation)}`
      );

      const bubbles = bubblesG.selectAll("circle")
        .data(yearData, d => d.iso3);

      bubbles.exit()
        .transition()
        .duration(200)
        .attr("r", 0)
        .remove();

      const bubblesEnter = bubbles.enter()
        .append("circle")
        .attr("cx", d => x(d.education))
        .attr("cy", d => y(d.fertility))
        .attr("r", 0)
        .attr("fill", d => getIncomeLevel(d.incomeCode).color)
        .attr("fill-opacity", 0.75)
        .attr("stroke", "#1f2937")
        .attr("stroke-width", 0.8)
        .on("mouseover", function(event, d) {
          const incomeLevel = getIncomeLevel(d.incomeCode);

          d3.select(this)
            .attr("stroke-width", 1.4)
            .attr("fill-opacity", 0.9);

          educationTooltip
            .style("opacity", 1)
            .html(`
              <strong>${d.country}</strong><br/>
              Education: ${fmtEducation(d.education)}% gross<br/>
              Fertility: ${fmtFertilityRate(d.fertility)} births per woman<br/>
              Population: ${fmtPopulation(d.population)}<br/>
              Income level: ${incomeLevel.label}
            `);
        })
        .on("mousemove", function(event) {
          educationTooltip
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", function() {
          d3.select(this)
            .attr("stroke-width", 0.8)
            .attr("fill-opacity", 0.75);

          educationTooltip.style("opacity", 0);
        });

      bubblesEnter.merge(bubbles)
        .transition()
        .duration(350)
        .attr("cx", d => x(d.education))
        .attr("cy", d => y(d.fertility))
        .attr("fill", d => getIncomeLevel(d.incomeCode).color)
        .attr("r", d => size(d.population));
    }

    updateEducationChart(educationSlider.property("value"));

    educationSlider.on("input", function() {
      updateEducationChart(this.value);
    });
  });
})();

(() => {
  const gdpYearLabel = d3.select("#gdp-year-label");
  const gdpSlider = d3.select("#gdp-year-slider");
  const chartWrap = d3.select("#gdp-chart");

  const gdpTooltip = d3
    .select("body")
    .append("div")
    .attr("class", "gdp-tooltip");

  const fmtgdp = d3.format(".2f");
  const fmtFertilityRate = d3.format(".2f");
  const fmtPopulation = d3.format(",");

  const margin = { top: 24, right: 24, bottom: 56, left: 64 };
  const chartWidth = 960;
  const chartHeight = 520;
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const svg = chartWrap
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

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
    .text("GDP (dollars)");

  yAxisG
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -48)
    .attr("fill", "#111")
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .text("Fertility rate (births per woman)");

  const bubblesG = g.append("g");
  const correlationLabel = g.append("text")
    .attr("x", innerWidth)
    .attr("y", 10)
    .attr("text-anchor", "end")
    .attr("fill", "#334155")
    .attr("font-size", 12)
    .attr("font-weight", 600);

  const incomeLevels = [
    { code: "L", label: "Low income", shortLabel: "Low", color: "#7c3aed" },
    { code: "LM", label: "Lower-middle income", shortLabel: "Lower-mid", color: "#0f766e" },
    { code: "UM", label: "Upper-middle income", shortLabel: "Upper-mid", color: "#d97706" },
    { code: "H", label: "High income", shortLabel: "High", color: "#dc2626" },
    { code: null, label: "No classification", shortLabel: "N/A", color: "#94a3b8" }
  ];

  function getIncomeLevel(code) {
    return incomeLevels.find(level => level.code === code) || incomeLevels[incomeLevels.length - 1];
  }

  function parseIncomeClassifications(text) {
    const rows = d3.csvParseRows(text);
    const yearRow = rows.find(row => row[1] === "Data for calendar year :");
    const classifications = new Map();

    if (!yearRow) {
      return classifications;
    }

    rows.forEach(row => {
      const iso3 = row[0];

      if (!iso3 || iso3.length !== 3) {
        return;
      }

      yearRow.forEach((yearValue, index) => {
        const year = +yearValue;
        const code = row[index];

        if (Number.isFinite(year) && ["L", "LM", "UM", "H"].includes(code)) {
          classifications.set(`${iso3}-${year}`, code);
        }
      });
    });

    return classifications;
  }

  const legend = g.append("g")
    .attr("transform", `translate(${innerWidth - 820}, 10)`);

  legend.append("text")
    .attr("x", 0)
    .attr("y", 4)
    .attr("fill", "#334155")
    .attr("font-size", 11)
    .attr("font-weight", 700)
    .text("Income level");

  const legendItems = legend.selectAll("g")
    .data(incomeLevels)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(${84 + i * 76}, 0)`);

  legendItems.append("circle")
    .attr("cx", 5)
    .attr("cy", 0)
    .attr("r", 4)
    .attr("fill", d => d.color)
    .attr("fill-opacity", 0.7);

  legendItems.append("text")
    .attr("x", 13)
    .attr("y", 4)
    .attr("fill", "#334155")
    .attr("font-size", 10)
    .text(d => d.shortLabel);

  const sizeLegend = legend.append("g")
    .attr("transform", "translate(470, 0)");

  sizeLegend.append("circle")
    .attr("cx", 5)
    .attr("cy", 0)
    .attr("r", 7)
    .attr("fill", "none")
    .attr("stroke", "#334155")
    .attr("stroke-width", 1);

  sizeLegend.append("text")
    .attr("x", 18)
    .attr("y", 4)
    .attr("fill", "#334155")
    .attr("font-size", 10)
    .text("Size = population");

  Promise.all([
    d3.csv("data/data.csv"),
    d3.text("data/income_classifications.csv")
  ]).then(([data, incomeText]) => {
    const incomeClassifications = parseIncomeClassifications(incomeText);

    data.forEach(d => {
      d.year = +d.year;
      d.fertility = d.fertility === "" ? null : +d.fertility;
      d.gdp = d.gdp === "" ? null : +d.gdp;
      d.population = d.population === "" ? null : +d.population;
    });

    const validData = data.filter(
      d => d.year != null && d.fertility != null && d.gdp != null && d.population != null
    );

    const years = Array.from(new Set(validData.map(d => d.year))).sort((a, b) => a - b);

    gdpSlider
      .attr("min", d3.min(years))
      .attr("max", d3.max(years))
      .attr("step", 1)
      .property("value", d3.min(years));

    const x = d3.scaleLinear()
      .domain([0, d3.max(validData, d => d.gdp)])
      .nice()
      .range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(validData, d => d.fertility)])
      .nice()
      .range([innerHeight, 0]);

    const size = d3.scaleSqrt()
      .domain(d3.extent(validData, d => d.population))
      .range([3, 20]);

    xAxisG.call(d3.axisBottom(x).ticks(6));
    yAxisG.call(d3.axisLeft(y).ticks(6));

    g.append("g")
      .attr("class", "grid-lines")
      .attr("stroke", "#eef3f7")
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", 0.7)
      .attr("pointer-events", "none")
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat("").ticks(6))
      .call(g => g.select(".domain").remove())
      .lower();

    g.append("g")
      .attr("class", "grid-lines")
      .attr("transform", `translate(0,${innerHeight})`)
      .attr("stroke", "#eef3f7")
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", 0.7)
      .attr("pointer-events", "none")
      .call(d3.axisBottom(x).tickSize(-innerHeight).tickFormat("").ticks(6))
      .call(g => g.select(".domain").remove())
      .lower();

    function pearsonCorrelation(values) {
      if (values.length < 2) return null;

      const meanX = d3.mean(values, d => d.gdp);
      const meanY = d3.mean(values, d => d.fertility);

      let numerator = 0;
      let sumSqX = 0;
      let sumSqY = 0;

      values.forEach(d => {
        const dx = d.gdp - meanX;
        const dy = d.fertility - meanY;
        numerator += dx * dy;
        sumSqX += dx * dx;
        sumSqY += dy * dy;
      });

      const denominator = Math.sqrt(sumSqX * sumSqY);
      return denominator ? numerator / denominator : null;
    }

    function updategdpChart(year) {
      year = +year;
      gdpYearLabel.text(year);

      const yearData = validData
        .filter(d => d.year === year)
        .map(d => ({
          ...d,
          incomeCode: incomeClassifications.get(`${d.iso3}-${year}`) || null
        }))
        .sort((a, b) => b.population - a.population);

      const correlation = pearsonCorrelation(yearData);
      correlationLabel.text(
        correlation == null
          ? "Correlation: N/A"
          : `Correlation (r): ${d3.format(".2f")(correlation)}`
      );

      const bubbles = bubblesG.selectAll("circle")
        .data(yearData, d => d.iso3);

      bubbles.exit()
        .transition()
        .duration(200)
        .attr("r", 0)
        .remove();

      const bubblesEnter = bubbles.enter()
        .append("circle")
        .attr("cx", d => x(d.gdp))
        .attr("cy", d => y(d.fertility))
        .attr("r", 0)
        .attr("fill", d => getIncomeLevel(d.incomeCode).color)
        .attr("fill-opacity", 0.75)
        .attr("stroke", "#1f2937")
        .attr("stroke-width", 0.8)
        .on("mouseover", function(event, d) {
          const incomeLevel = getIncomeLevel(d.incomeCode);

          d3.select(this)
            .attr("stroke-width", 1.4)
            .attr("fill-opacity", 0.9);

          gdpTooltip
            .style("opacity", 1)
            .html(`
              <strong>${d.country}</strong><br/>
              GDP: ${fmtgdp(d.gdp)} dollars<br/>
              Fertility: ${fmtFertilityRate(d.fertility)} births per woman<br/>
              Population: ${fmtPopulation(d.population)}<br/>
              Income level: ${incomeLevel.label}
            `);
        })
        .on("mousemove", function(event) {
          gdpTooltip
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", function() {
          d3.select(this)
            .attr("stroke-width", 0.8)
            .attr("fill-opacity", 0.75);

          gdpTooltip.style("opacity", 0);
        });

      bubblesEnter.merge(bubbles)
        .transition()
        .duration(350)
        .attr("cx", d => x(d.gdp))
        .attr("cy", d => y(d.fertility))
        .attr("fill", d => getIncomeLevel(d.incomeCode).color)
        .attr("r", d => size(d.population));
    }

    updategdpChart(gdpSlider.property("value"));

    gdpSlider.on("input", function() {
      updategdpChart(this.value);
    });
  });
})();


// PUBLIC SPENDING ANALYSIS
(() => {
  const spendingComponents = [
    { key: "public_spending_cash", label: "Cash benefits", color: "#0f766e" },
    { key: "public_spending_services", label: "Services", color: "#2563eb" },
    { key: "public_spending_tax_breaks", label: "Tax breaks", color: "#d97706" }
  ];

  const sortSelect = d3.select("#public-spending-sort");
  const spendingYearLabel = d3.select("#public-spending-year-label");
  const spendingSlider = d3.select("#public-spending-year-slider");
  const chartWrap = d3.select("#public-spending-chart");

  if (chartWrap.empty()) {
    return;
  }

  const spendingTooltip = d3
    .select("body")
    .append("div")
    .attr("class", "public-spending-tooltip");

  const fmtSpending = d3.format(".2f");
  const fmtFertilityRate = d3.format(".2f");
  const fmtPopulation = d3.format(",");

  const margin = { top: 74, right: 34, bottom: 58, left: 156 };
  const chartWidth = 960;
  const chartHeight = 760;
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const svg = chartWrap
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const spendingX = d3.scaleLinear().range([0, innerWidth]);
  const fertilityX = d3.scaleLinear().range([0, innerWidth]);
  const y = d3.scaleBand().range([0, innerHeight]).paddingInner(0.24).paddingOuter(0.12);

  const spendingGridG = g
    .append("g")
    .attr("class", "grid-lines")
    .attr("transform", `translate(0,${innerHeight})`)
    .attr("stroke", "#eef3f7")
    .attr("stroke-opacity", 0.35)
    .attr("stroke-width", 0.7)
    .attr("pointer-events", "none");

  const spendingAxisG = g
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`);

  const fertilityAxisG = g.append("g");
  const yAxisG = g.append("g");
  const barsG = g.append("g");
  const fertilityG = g.append("g")
    .attr("pointer-events", "none");

  spendingAxisG
    .append("text")
    .attr("x", innerWidth / 2)
    .attr("y", 44)
    .attr("fill", "#111")
    .attr("text-anchor", "middle")
    .attr("font-size", 12);

  fertilityAxisG
    .append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -36)
    .attr("fill", "#111")
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .text("Fertility rate (births per woman)");

  spendingAxisG.select("text").text("Public spending on family benefits (% of GDP)");

  const noDataLabel = g
    .append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#64748b")
    .attr("font-size", 14)
    .attr("font-weight", 600)
    .style("display", "none");

  const mixLegend = g
    .append("g")
    .attr("transform", "translate(0, -66)");

  spendingComponents.forEach((component, index) => {
    const item = mixLegend
      .append("g")
      .attr("transform", `translate(${index * 130}, 0)`);

    item
      .append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("rx", 2)
      .attr("fill", component.color);

    item
      .append("text")
      .attr("x", 18)
      .attr("y", 10)
      .attr("fill", "#334155")
      .attr("font-size", 11)
      .attr("font-weight", 600)
      .text(component.label);
  });

  const fertilityLegend = mixLegend
    .append("g")
    .attr("transform", `translate(${spendingComponents.length * 130 + 8}, 6)`);

  fertilityLegend
    .append("circle")
    .attr("cx", 6)
    .attr("cy", 0)
    .attr("r", 5)
    .attr("fill", "#111827");

  fertilityLegend
    .append("text")
    .attr("x", 18)
    .attr("y", 4)
    .attr("fill", "#334155")
    .attr("font-size", 11)
    .attr("font-weight", 600)
    .text("Fertility rate");

  d3.csv("data/data.csv").then(data => {
    data.forEach(d => {
      d.year = +d.year;
      d.fertility = d.fertility === "" ? null : +d.fertility;
      d.population = d.population === "" ? null : +d.population;
      d.public_spending_total = d.public_spending_total === "" ? null : +d.public_spending_total;
      spendingComponents.forEach(component => {
        d[component.key] = d[component.key] === "" ? null : +d[component.key];
      });
    });

    const validData = data.filter(d =>
      d.year != null &&
      d.fertility != null &&
      (d.public_spending_total != null || spendingComponents.some(component => d[component.key] != null))
    );

    const years = Array.from(new Set(validData.map(d => d.year))).sort((a, b) => a - b);
    const latestYear = d3.max(years);

    spendingSlider
      .attr("min", d3.min(years))
      .attr("max", latestYear)
      .attr("step", 1)
      .property("value", latestYear);

    fertilityX.domain([0, d3.max(validData, d => d.fertility)]).nice();
    fertilityAxisG.call(d3.axisTop(fertilityX).ticks(6));

    let hasRenderedPublicSpending = false;
    const transitionDuration = 500;

    function updatePublicSpendingChart() {
      const shouldAnimate = hasRenderedPublicSpending;
      const year = +spendingSlider.property("value");
      const sortBy = sortSelect.property("value");
      spendingYearLabel.text(year);

      const yearData = validData
        .filter(d => d.year === year)
        .map(d => {
          const components = spendingComponents.map(component => ({
            ...component,
            value: d[component.key] || 0
          }));
          const componentTotal = d3.sum(components, component => component.value);

          return {
            ...d,
            components,
            componentTotal,
            totalSpending: d.public_spending_total ?? componentTotal
          };
        })
        .filter(d => d.componentTotal > 0 || d.totalSpending > 0);

      yearData.sort((a, b) => {
        if (sortBy === "fertility") return d3.descending(a.fertility, b.fertility);
        if (sortBy === "country") return d3.ascending(a.country, b.country);
        return d3.descending(a.totalSpending, b.totalSpending);
      });

      y.domain(yearData.map(d => d.country));
      spendingX.domain([0, d3.max(yearData, d => Math.max(d.totalSpending, d.componentTotal)) || 1]).nice();

      const spendingAxis = shouldAnimate
        ? spendingAxisG.transition().duration(transitionDuration)
        : spendingAxisG;

      spendingAxis.call(d3.axisBottom(spendingX).ticks(6));

      spendingAxisG.select("text")
        .attr("x", innerWidth / 2)
        .attr("y", 44)
        .attr("fill", "#111")
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .text("Public spending on family benefits (% of GDP)");

      const spendingGrid = shouldAnimate
        ? spendingGridG.transition().duration(transitionDuration)
        : spendingGridG;

      spendingGrid
        .call(d3.axisBottom(spendingX).tickSize(-innerHeight).tickFormat("").ticks(6))
        .call(axis => axis.select(".domain").remove());

      spendingGridG.lower();

      const yAxis = shouldAnimate
        ? yAxisG.transition().duration(transitionDuration)
        : yAxisG;

      yAxis.call(d3.axisLeft(y).tickSize(0));

      yAxisG.select(".domain").remove();

      noDataLabel
        .style("display", yearData.length ? "none" : null)
        .text(`No public spending data for ${year}`);

      const rows = barsG.selectAll("g.public-spending-row")
        .data(yearData, d => d.iso3);

      rows.exit()
        .transition()
        .duration(shouldAnimate ? 220 : 0)
        .style("opacity", 0)
        .remove();

      const rowsEnter = rows.enter()
        .append("g")
        .attr("class", "public-spending-row")
        .attr("transform", d => `translate(0,${y(d.country) || 0})`)
        .style("opacity", shouldAnimate ? 0 : 1);

      rowsEnter
        .append("rect")
        .attr("class", "public-spending-row-hitbox")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", innerWidth)
        .attr("height", y.bandwidth())
        .attr("fill", "transparent");

      const rowsMerged = rowsEnter.merge(rows)
        .on("mouseover", function(event, d) {
          d3.select(this).selectAll(".public-spending-segment").attr("stroke-opacity", 0.85);
          d3.select(this).select("circle").attr("r", 5.5);

          spendingTooltip
            .style("opacity", 1)
            .html(`
              <strong>${d.country}</strong><br/>
              Total family benefits: ${fmtSpending(d.totalSpending)}% of GDP<br/>
              Cash: ${fmtSpending(d.public_spending_cash || 0)}%<br/>
              Services: ${fmtSpending(d.public_spending_services || 0)}%<br/>
              Tax breaks: ${fmtSpending(d.public_spending_tax_breaks || 0)}%<br/>
              Fertility: ${fmtFertilityRate(d.fertility)} births per woman<br/>
              Population: ${d.population == null ? "No data" : fmtPopulation(Math.round(d.population))}
            `);
        })
        .on("mousemove", function(event) {
          spendingTooltip
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", function() {
          d3.select(this).selectAll(".public-spending-segment").attr("stroke-opacity", 0);
          d3.select(this).select("circle").attr("r", 4.5);
          spendingTooltip.style("opacity", 0);
        });

      rowsMerged.select(".public-spending-row-hitbox")
        .attr("height", y.bandwidth());

      const rowPosition = shouldAnimate
        ? rowsMerged.transition().duration(transitionDuration)
        : rowsMerged;

      rowPosition
        .style("opacity", 1)
        .attr("transform", d => `translate(0,${y(d.country) || 0})`);

      rowsMerged.each(function(row) {
        let x0 = 0;
        const segments = row.components.map(component => {
          const segment = {
            ...component,
            x0,
            x1: x0 + component.value
          };
          x0 = segment.x1;
          return segment;
        });

        const segmentRects = d3.select(this)
          .selectAll("rect.public-spending-segment")
          .data(segments, d => d.key);

        const segmentRectsEnter = segmentRects.enter()
          .append("rect")
          .attr("class", "public-spending-segment")
          .attr("x", d => spendingX(d.x0))
          .attr("y", 0)
          .attr("height", y.bandwidth())
          .attr("width", shouldAnimate ? 0 : d => Math.max(0, spendingX(d.x1) - spendingX(d.x0)))
          .attr("fill", d => d.color)
          .attr("stroke", "#111827")
          .attr("stroke-opacity", 0)
          .attr("stroke-width", 0.7);

        const segmentRectsMerged = segmentRectsEnter.merge(segmentRects);
        const segmentUpdate = shouldAnimate
          ? segmentRectsMerged.transition().duration(transitionDuration)
          : segmentRectsMerged;

        segmentUpdate
          .attr("x", d => spendingX(d.x0))
          .attr("y", 0)
          .attr("height", y.bandwidth())
          .attr("width", d => Math.max(0, spendingX(d.x1) - spendingX(d.x0)))
          .attr("fill", d => d.color);

        segmentRects.exit().remove();
      });

      const fertilityDots = fertilityG.selectAll("circle")
        .data(yearData, d => d.iso3);

      fertilityDots.exit()
        .transition()
        .duration(shouldAnimate ? 220 : 0)
        .attr("r", 0)
        .remove();

      const fertilityDotsEnter = fertilityDots.enter()
        .append("circle")
        .attr("cx", d => fertilityX(d.fertility))
        .attr("cy", d => (y(d.country) || 0) + y.bandwidth() / 2)
        .attr("r", shouldAnimate ? 0 : 4.5)
        .attr("fill", "#111827")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.2);

      const fertilityDotsMerged = fertilityDotsEnter.merge(fertilityDots);
      const fertilityDotsUpdate = shouldAnimate
        ? fertilityDotsMerged.transition().duration(transitionDuration)
        : fertilityDotsMerged;

      fertilityDotsUpdate
        .attr("cx", d => fertilityX(d.fertility))
        .attr("cy", d => (y(d.country) || 0) + y.bandwidth() / 2)
        .attr("r", 4.5);

      hasRenderedPublicSpending = true;
    }

    updatePublicSpendingChart();

    sortSelect.on("change", updatePublicSpendingChart);
    spendingSlider.on("input", updatePublicSpendingChart);
  });
})();


// COUNTRY STORYLINES
(() => {
  const chartWrap = d3.select("#country-storyline-chart");
  const countrySelect = d3.select("#storyline-country-select");
  const metricSelect = d3.select("#storyline-metric-select");

  if (chartWrap.empty()) {
    return;
  }

  const metricConfig = {
    gdp: {
      label: "GDP per capita",
      axisLabel: "GDP per capita (current US$)",
      format: d => `$${d3.format(",.0f")(d)}`
    },
    urban: {
      label: "Urbanization",
      axisLabel: "Urban population (% of total)",
      format: d => `${d3.format(".1f")(d)}%`
    },
    education: {
      label: "Female tertiary enrollment",
      axisLabel: "Female tertiary enrollment (% gross)",
      format: d => `${d3.format(".1f")(d)}%`
    },
    population: {
      label: "Population",
      axisLabel: "Population",
      format: d => d3.format(",.0f")(d)
    }
  };

  const storylineTooltip = d3
    .select("body")
    .append("div")
    .attr("class", "country-storyline-tooltip");

  const margin = { top: 48, right: 86, bottom: 54, left: 68 };
  const chartWidth = 960;
  const chartHeight = 460;
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const svg = chartWrap
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().range([0, innerWidth]);
  const yFertility = d3.scaleLinear().range([innerHeight, 0]);
  const yMetric = d3.scaleLinear().range([innerHeight, 0]);

  const xAxisG = g.append("g").attr("transform", `translate(0,${innerHeight})`);
  const fertilityAxisG = g.append("g");
  const metricAxisG = g.append("g").attr("transform", `translate(${innerWidth},0)`);

  xAxisG
    .append("text")
    .attr("x", innerWidth / 2)
    .attr("y", 40)
    .attr("fill", "#111")
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .text("Year");

  fertilityAxisG
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -50)
    .attr("fill", "#1d4ed8")
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .text("Fertility rate");

  const metricAxisLabel = metricAxisG
    .append("text")
    .attr("transform", "rotate(90)")
    .attr("x", innerHeight / 2)
    .attr("y", -58)
    .attr("fill", "#b45309")
    .attr("text-anchor", "middle")
    .attr("font-size", 12);

  const gridG = g
    .append("g")
    .attr("class", "grid-lines")
    .attr("stroke", "#eef3f7")
    .attr("stroke-opacity", 0.45)
    .attr("stroke-width", 0.7)
    .attr("pointer-events", "none");

  const linesG = g.append("g");

  const fertilityPath = linesG
    .append("path")
    .attr("fill", "none")
    .attr("stroke", "#1d4ed8")
    .attr("stroke-width", 2.4);

  const metricPath = linesG
    .append("path")
    .attr("fill", "none")
    .attr("stroke", "#b45309")
    .attr("stroke-width", 2.4);

  const focusG = g
    .append("g")
    .attr("pointer-events", "none")
    .style("opacity", 0);

  focusG
    .append("line")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#64748b")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4,4");

  focusG
    .append("circle")
    .attr("class", "focus-fertility")
    .attr("r", 4.5)
    .attr("fill", "#1d4ed8")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.2);

  focusG
    .append("circle")
    .attr("class", "focus-metric")
    .attr("r", 4.5)
    .attr("fill", "#b45309")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.2);

  g.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mousemove", function(event) {
      const activeRows = g.datum();
      if (!activeRows?.length) return;

      const [mx] = d3.pointer(event, this);
      const year = Math.round(x.invert(mx));
      const row = activeRows.reduce((closest, current) =>
        Math.abs(current.year - year) < Math.abs(closest.year - year) ? current : closest
      );
      const metricKey = metricSelect.property("value");
      const metric = metricConfig[metricKey];

      focusG
        .style("opacity", 1)
        .attr("transform", `translate(${x(row.year)},0)`);

      focusG.select(".focus-fertility")
        .attr("cy", yFertility(row.fertility));

      focusG.select(".focus-metric")
        .style("display", row[metricKey] == null ? "none" : null)
        .attr("cy", row[metricKey] == null ? 0 : yMetric(row[metricKey]));

      storylineTooltip
        .style("opacity", 1)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY + 12}px`)
        .html(`
          <strong>${countrySelect.property("selectedOptions")[0]?.text || ""}</strong><br/>
          Year: ${row.year}<br/>
          Fertility: ${d3.format(".2f")(row.fertility)} births per woman<br/>
          ${metric.label}: ${row[metricKey] == null ? "No data" : metric.format(row[metricKey])}
        `);
    })
    .on("mouseout", function() {
      focusG.style("opacity", 0);
      storylineTooltip.style("opacity", 0);
    });

  const legend = g.append("g").attr("transform", "translate(0, -28)");

  legend.append("line")
    .attr("x1", 0)
    .attr("x2", 24)
    .attr("stroke", "#1d4ed8")
    .attr("stroke-width", 2.4);

  legend.append("text")
    .attr("x", 32)
    .attr("y", 4)
    .attr("fill", "#334155")
    .attr("font-size", 11)
    .attr("font-weight", 600)
    .text("Fertility rate");

  legend.append("line")
    .attr("class", "storyline-metric-legend-line")
    .attr("x1", 142)
    .attr("x2", 166)
    .attr("stroke", "#b45309")
    .attr("stroke-width", 2.4);

  const metricLegendLabel = legend.append("text")
    .attr("x", 174)
    .attr("y", 4)
    .attr("fill", "#334155")
    .attr("font-size", 11)
    .attr("font-weight", 600);

  const storylineNoDataLabel = g
    .append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#64748b")
    .attr("font-size", 14)
    .attr("font-weight", 600)
    .style("display", "none");

  function numericOrNull(value) {
    if (value === "") return null;
    const number = +value;
    return Number.isFinite(number) ? number : null;
  }

  d3.csv("data/data.csv").then(data => {
    data.forEach(d => {
      d.year = +d.year;
      d.fertility = numericOrNull(d.fertility);
      Object.keys(metricConfig).forEach(metric => {
        d[metric] = numericOrNull(d[metric]);
      });
    });

    const countries = Array.from(
      d3.group(
        data.filter(d => d.iso3 && d.country && d.fertility != null),
        d => d.iso3
      ),
      ([iso3, rows]) => {
        const sortedRows = rows.sort((a, b) => d3.ascending(a.year, b.year));
        const baseline = sortedRows.find(d => d.year === 1990);
        const latest = sortedRows[sortedRows.length - 1];

        return {
          iso3,
          country: sortedRows[0].country,
          baselineFertility: baseline?.fertility,
          latestFertility: latest?.fertility,
          latestYear: latest?.year,
          decline: baseline?.fertility == null || latest?.fertility == null
            ? null
            : baseline.fertility - latest.fertility
        };
      }
    )
      .filter(d => d.decline != null && d.latestYear > 1990)
      .sort((a, b) => d3.descending(a.decline, b.decline))
      .slice(0, 20);

    countrySelect
      .selectAll("option")
      .data(countries)
      .enter()
      .append("option")
      .attr("value", d => d.iso3)
      .text(d => `${d.country} (-${d3.format(".2f")(d.decline)})`);

    countrySelect.property("value", countries[0]?.iso3);

    function updateStorylineChart() {
      const iso3 = countrySelect.property("value");
      const metricKey = metricSelect.property("value");
      const metric = metricConfig[metricKey];
      const countryRows = data
        .filter(d => d.iso3 === iso3 && d.fertility != null)
        .sort((a, b) => d3.ascending(a.year, b.year));
      const metricRows = countryRows.filter(d => d[metricKey] != null);
      const selectedCountry = countrySelect.property("selectedOptions")[0]?.text.replace(/\s+\(-?\d+\.\d+\)$/, "") || "this country";

      if (!metricRows.length) {
        g.datum([]);
        fertilityPath.datum([]).attr("d", null);
        metricPath.datum([]).attr("d", null);
        focusG.style("opacity", 0);
        storylineTooltip.style("opacity", 0);
        storylineNoDataLabel
          .style("display", null)
          .text(`No ${metric.label.toLowerCase()} data available for ${selectedCountry}.`);
        xAxisG.selectAll(".tick").remove();
        fertilityAxisG.selectAll(".tick").remove();
        metricAxisG.selectAll(".tick").remove();
        gridG.selectAll("*").remove();
        metricLegendLabel.text(metric.label);
        metricAxisLabel.text(metric.axisLabel);
        return;
      }

      storylineNoDataLabel.style("display", "none");
      const xRows = metricRows.length ? metricRows : countryRows;
      const xExtent = d3.extent(xRows, d => d.year);
      const visibleRows = countryRows.filter(d => d.year >= xExtent[0] && d.year <= xExtent[1]);

      g.datum(visibleRows);

      x.domain(xExtent);
      yFertility.domain([0, d3.max(visibleRows, d => d.fertility) || 1]).nice();
      yMetric.domain([0, d3.max(metricRows, d => d[metricKey]) || 1]).nice();

      xAxisG.transition().duration(350).call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(7));
      fertilityAxisG.transition().duration(350).call(d3.axisLeft(yFertility).ticks(6));
      metricAxisG.transition().duration(350).call(d3.axisRight(yMetric).ticks(6));

      fertilityAxisG.select("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -50)
        .attr("fill", "#1d4ed8")
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .text("Fertility rate");

      metricAxisLabel
        .attr("transform", "rotate(90)")
        .attr("x", innerHeight / 2)
        .attr("y", -58)
        .attr("fill", "#b45309")
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .text(metric.axisLabel);

      gridG
        .transition()
        .duration(350)
        .call(d3.axisLeft(yFertility).tickSize(-innerWidth).tickFormat("").ticks(6))
        .call(axis => axis.select(".domain").remove())
        .selection()
        .lower();

      const fertilityLine = d3.line()
        .defined(d => d.fertility != null)
        .x(d => x(d.year))
        .y(d => yFertility(d.fertility));

      const metricLine = d3.line()
        .defined(d => d[metricKey] != null)
        .x(d => x(d.year))
        .y(d => yMetric(d[metricKey]));

      fertilityPath
        .datum(visibleRows)
        .transition()
        .duration(450)
        .attr("d", fertilityLine);

      metricPath
        .datum(visibleRows)
        .transition()
        .duration(450)
        .attr("d", metricLine);

      metricLegendLabel.text(metric.label);
      focusG.style("opacity", 0);
      storylineTooltip.style("opacity", 0);
    }

    updateStorylineChart();

    countrySelect.on("change", updateStorylineChart);
    metricSelect.on("change", updateStorylineChart);
  });
})();


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

  const lifestyleTooltip = d3
    .select("body")
    .append("div")
    .attr("class", "lifestyle-tooltip");

  const fmtFertility = d3.format(".2f");
  const fmtCommas = d3.format(",");
  const fmtPct = d3.format(".2f");

  const margin = { top: 30, right: 30, bottom: 55, left: 70 };
  const chartWidth = 820;
  const chartHeight = 460;
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

  const legendWrap = d3.select("#lifestyle-legend-container");
  const legendSvg = legendWrap
    .append("svg")
    .attr("width", 140)
    .attr("height", 250);

  legendSvg
    .append("text")
    .attr("x", 0)
    .attr("y", 14)
    .attr("fill", "#111")
    .attr("font-size", 11)
    .attr("font-weight", 700)
    .text("Urbanization Rate (%)");

  const barX = 26;
  const barY = 34;
  const barW = 20;
  const barH = 200;

  const legendY = d3.scaleLinear().domain([0, 100]).range([barY + barH, barY]);

  const defs = legendSvg.append("defs");
  const urbanGradient = defs
    .append("linearGradient")
    .attr("id", "lifestyle-urban-ylgnbu-gradient")
    .attr("gradientUnits", "objectBoundingBox")
    .attr("x1", "0")
    .attr("x2", "0")
    .attr("y1", "1")
    .attr("y2", "0");

  for (let pct = 0; pct <= 100; pct += 1) {
    const t = pct / 100;
    urbanGradient
      .append("stop")
      .attr("offset", `${pct}%`)
      .attr("stop-color", d3.interpolateYlGnBu(t));
  }

  legendSvg
    .append("rect")
    .attr("x", barX)
    .attr("y", barY)
    .attr("width", barW)
    .attr("height", barH)
    .attr("rx", 3)
    .attr("ry", 3)
    .attr("stroke", "#17324a")
    .attr("stroke-opacity", 0.25)
    .attr("fill", "url(#lifestyle-urban-ylgnbu-gradient)");

  const axisG = legendSvg
    .append("g")
    .attr("transform", `translate(${barX + barW},0)`);

  const urbanAxis = d3
    .axisRight(legendY)
    .tickValues([0, 50, 100])
    .tickFormat(d => `${d}%`)
    .tickSize(4);

  axisG.call(urbanAxis);
  axisG.select(".domain").remove();
  axisG.selectAll(".tick line").attr("stroke", "#444");
  axisG.selectAll(".tick text").attr("fill", "#111").attr("font-size", 10);

  const urbanLegendPointer = legendSvg
    .append("line")
    .attr("stroke", "#111")
    .attr("stroke-width", 2)
    .attr("stroke-linecap", "round")
    .attr("x1", barX + barW)
    .attr("x2", barX + barW + 14)
    .attr("y1", legendY(0))
    .attr("y2", legendY(0))
    .style("opacity", 0);

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

      const merged = circles
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
        .merge(circles);

      merged
        .on("mouseover", function (event, d) {
          d3.select(this)
            .attr("stroke-width", 2.5)
            .attr("stroke-opacity", 0.95);

          const yy = legendY(d.urban);
          urbanLegendPointer.interrupt();
          urbanLegendPointer
            .style("opacity", 1)
            .transition()
            .duration(250)
            .attr("y1", yy)
            .attr("y2", yy);

          lifestyleTooltip
            .style("opacity", 1)
            .html(`
              <div class="title">${d.region}</div>
              <div>Fertility: ${fmtFertility(d.fertility)} births per woman</div>
              <div>Internet: ${fmtPct(d.internet)}% of population</div>
              <div>Urbanization: ${fmtPct(d.urban)}% urban</div>
              <div>Total Population: ${fmtCommas(Math.round(d.pop))}</div>
            `);
        })
        .on("mousemove", function (event, d) {
          lifestyleTooltip
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY + 15) + "px");

          const yy = legendY(d.urban);
          urbanLegendPointer.interrupt();
          urbanLegendPointer
            .style("opacity", 1)
            .transition()
            .duration(250)
            .attr("y1", yy)
            .attr("y2", yy);
        })
        .on("mouseout", function () {
          d3.select(this)
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.35);

          urbanLegendPointer.interrupt();
          urbanLegendPointer.transition().duration(150).style("opacity", 0);

          lifestyleTooltip.style("opacity", 0);
        })
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
