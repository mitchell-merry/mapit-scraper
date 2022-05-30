import fetch from 'node-fetch';
import Bottleneck from 'bottleneck';
import fs from 'fs';

const limiter = new Bottleneck({
    minTime: 100,
    maxConcurrent: 2,
});

const fetch_l = limiter.wrap(fetch);

/* 
    Get the RELATION by going to http://global.mapit.mysociety.org/code/osm_rel/${CODE} and looking at the URL redirected to.
    where CODE is the relation number.
*/
const RELATION = 958847; // phnom penh
const PROP_NAME = "all_names";
const DEFAULT = "kh";

// Fetch all sub areas info
const res = await fetch_l(`https://global.mapit.mysociety.org/area/${RELATION}/covers`).then(r => r.json());
console.log("Initial data fetched.");

let count = 0, total = Object.keys(res).length;
console.log(`Fetching ${total} features...`);

// Fetch features
const features = Object.keys(res).map(id => {
    const feature_props = fetch_l(`https://global.mapit.mysociety.org/area/${id}`).then(r => r.json());
    const feature_geometry = fetch_l(`https://global.mapit.mysociety.org/area/${id}.geojson`).then(r => r.json());

    return Promise.all([feature_props, feature_geometry]).then(r => {
        console.log(`[${++count}/${total}] Fetched ${id}.`);
        return r;
    });
});

const raw = await Promise.all(features);
console.log("Fetched all.");

/*
    Our geojson data format
*/
const data = {
    "type": "FeatureCollection",
    "metadata": {
        "propName": "name_en",
        "projection": "equirectangular"
    },
    "features": []
};

data.features = raw.map(f => {
    const [props, geometry] = f;
    
    let names = Object.fromEntries(Object.entries(props.all_names).map(([key, value]) => {
        let name = `name_${(key === "default") ? DEFAULT : key}`;
        return [ name, value[1] ];
    }));

    return {
        type: "Feature",
        properties: names,
        geometry
    };
});

console.log("Processed. Writing...")

// Write data
fs.writeFileSync(`./data/${RELATION}.geojson`, JSON.stringify(data));

console.log("Done!");