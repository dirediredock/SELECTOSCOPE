// Every word the controls speak or show on hover but never print: accessible
// names where there is no visible text (a glyph, a tile), and every tooltip (a
// tooltip is also its tray's accessible description). A control with visible
// text is named by that text, so a group of controls is named by its
// section's caps label. Visible words (option labels, section labels, pane
// titles) stay beside their ids. Kept in one place so the wording is edited
// and kept alike here.
//
// Format:
//   names         sentence case, a few words, no full stop ("Zoom out")
//   tooltips      cut from Help (docs/help.txt): each sentence is Help's words
//                 in Help's order from one paragraph, with words left out and
//                 the first letter capitalised if need be (controlText.test.ts
//                 checks every one). A tray's own name is cut, since it is
//                 read first; Help's CAPS for other controls stay. Every
//                 sentence ends with a full stop.
//   trays         a tray's tip is its lead (from Help's Control strips), then
//                 the chosen option's hint, then why the tray is idle, joined
//                 by trayTip (controls.tsx).

export const TEXT = {
  // The top strip.
  top: {
    selectSetTip: "Chooses whether a drawn area takes NODES, EDGES or BOTH.",
    countTip: "Shows how much of the graph each set holds; hover it and click CLEAR to empty the selection set.",
    // While a sweep is active the count follows the band and offers no Clear.
    countSweepTip: "Shows how much of the graph each set holds. While a sweep is active, the SELECTION COUNT follows the band.",
    brushTip: "Chooses a RECTANGLE or a LASSO as the modality for the drawn selection.",
    extendTip: "Grows your selection by one hop with ▲; ▼ steps back, but never removes what you picked yourself.",
    // Brush and Extend set, while a sweep is active.
    sweepingTip: "While a sweep is active, BRUSH and EXTEND SET are inactive.",
    themeTip: "CONTRAST fades everything but the selection set, and DARK can make selections stand out more.",
    grow: "Grow",
    shrink: "Shrink",
  },

  // Every pane's banner and header menu.
  pane: {
    sweepRunning: "Auto Sweep active",
    // The header, a tray of its own: the title's menu, then the zoom percent's fit or Data's ?.
    menuTip: "Click a pane's title or header to change pane type or pane aspect ratio.",
    fitTip: "Click a pane's zoom % to fit the visual pattern into the pane.",
    helpTip: "Click ? to switch between the DATA pane and HELP pane.",
    menu: "Pane type and shape",
    menuTypes: "Pane type",
    menuShapes: "Pane shape",
  },

  // The header menu's shape tiles, which show only a glyph.
  shapes: {
    tall: "Tall 3:1",
    portraitGolden: "Portrait golden",
    square: "Square",
    landscapeGolden: "Landscape golden",
    minimum: "Minimum",
  },

  // The bottom strip's Zoom stepper.
  zoom: {
    name: "Zoom",
    out: "Zoom out",
    in: "Zoom in",
    tip: "− and + zoom the pane out and in; click the % to fit the visual pattern into the pane.",
  },

  // The bottom strip's Auto Sweep and Sweep controls sections.
  sweep: {
    // Auto Sweep, by sweep state: idle, running, paused.
    runTip: "Click RUN to animate a band across the pane, lighting what it covers in every pane.",
    stopTip: "STOP ends the sweep.",
    resumeTip: "RESUME carries on a paused sweep.",
    controlsTip:
      "Shape the band: VERTICAL sets its direction, AREA how much of the pane it covers, SPEED how fast it travels, and ARROW steps it, as the arrow keys do.",
    // Labels' strip has no Vertical.
    controlsLabelsTip:
      "Shape the band: AREA how much of the pane it covers, SPEED how fast it travels, and ARROW steps it, as the arrow keys do.",
    idleTip: "They work only while a sweep is active.",
    stepForward: "Forwards step",
    stepBack: "Backwards step",
  },

  // Help's ? buttons, which show only a glyph, and its strip.
  help: {
    name: "Help",
    sections: "Sections",
    sectionsTip: "Follows the section of Help in view; pick one to go there.",
    figuresTip: "Turn off FIGURES to hide the diagrams and control copies, leaving the text alone.",
  },

  dataset: {
    uploadTip: "Chooses how your data comes in: BUILD FROM CSV or UPLOAD FROM JSON.",
    // Dataset, by what the Data pane rings.
    csvTip: "Add an edge list with + EDGELIST, type a NAME if you like, and click ADD to add the dataset to UPLOADED and show it.",
    jsonTip: "+ DATASET takes a build file saved by EXPORT; type a NAME if you like, and click ADD to open it as a new row.",
    curatedTip: "EXPORT JSON saves a finished dataset as one build file.",
    ownTip: "EXPORT JSON saves a finished dataset as one build file, and REMOVE takes your own row off the list.",
    buildingTip: "While your dataset builds, STOP stops the build; the row keeps what has landed.",
    changeTip:
      "Shows which files your dataset has and which it lacks; replacing the edge list, or adding or removing another file, builds it again at once.",
    thumbnailsTip:
      "Turn on THUMBNAILS to see a NODELINK preview of each dataset's BESPOKE 2D layout, or else the default force-directed 2D, with edges only.",
    newTip: "Click + NEW to upload your own data.",
    // A file pill's report tip ends with its file's Help sentence.
    replaceTip: "Replacing the edge list builds it again at once.",
    removeFileTip: "Removing another file builds it again at once.",
    dataTip: "Takes a build file saved by EXPORT and reads it at once, refusing a file that is not a build.",
    // The refusal hue's dot, which shows only a colour.
    alert: "Did not load",
  },

  labels: {
    sortTip: "Sorts the vertical order of rows by LABELS (A–Z), DEGREE, ONION or EIGENVECTOR.",
    // Shown in place of the rows when Labels (A–Z) has no labels to sort.
    missing: "Add labels",
  },

  nodelink: {
    // Shown in place of the drawing when the dataset lacks the layout picked.
    missing: {
      fd: "",
      fd3d: "Compute 3D layout",
      own2d: "Add a bespoke 2D layout",
      own3d: "Add a bespoke 3D layout",
    },
    layoutTip:
      "Shows the network in a force-directed 2D or 3D, or in the dataset's own BESPOKE 2D or BESPOKE 3D, and INTERACTIVE starts a force-directed simulation from the current layout, where nodes can be moved by dragging.",
    tooLargeTip: "Because of computing cost, INTERACTIVE mode is unavailable for datasets above 6000 nodes or 20000 edges.",
  },

  matrix: {
    seriationTip: "Sets the matrix seriation, or the symmetric ordering of nodes along the side of the matrix.",
    formTip: "Shows the matrix as a DIAMOND, with the diagonal running vertically, or as the traditional SQUARE.",
  },

  ksnakes: {
    orderingTip:
      "Sets the horizontal order of connected components, by TOP-DOWN or SIZE, and GROUP SINGLETONS collects the singletons within each k-core shell.",
    verticalTip:
      "Adjusts the aspect ratio of the visual pattern with SPACING, and GRIDLINES makes visible the vertical lines that bin component locations.",
  },

  hopcensus: {
    measureTip:
      "Orders the polylines by wave shape, by DEGREE, REACH, SPREAD or SKEW; SPACING sets how far they move horizontally, and RANKING sets each set of equal values in one evenly spaced column.",
  },

  // Each option's sentence, keyed by its id: the tray's tip adds the chosen
  // one's.
  hints: {
    upload: {
      csv: "Build a dataset from your own CSV files, computed in your browser.",
      json: "Open a build file saved by EXPORT, without computing anything.",
    },
    layout: {
      fd: "A standard force-directed 2D, seeded by the first two harmonics of the spectral eigendecomposition.",
      fd3d: "A force-directed 3D, seeded by the first three harmonics, for datasets that don't bring their own 3D layout.",
      own2d: "The dataset's own 2D layout.",
      own3d: "The dataset's own 3D layout.",
    },
    labelSort: {
      alpha: "An alphabetical sort, ignoring case, with numbers in numeric order, and unlabeled nodes last.",
      degree:
        "Degree centrality, or how many neighbors each node has, the most first. Degree is also the tie-breaker in the other numeric sorts.",
      onion:
        "The onion decomposition, or how deep a node sits in the graph's density gradient: the later a peeling of the least-connected nodes removes the node at hand, the higher its onion value. The deepest nodes come first.",
      eigenvector: "Eigenvector centrality, or how well connected a node's neighbors are, counted recursively, the highest first.",
    },
    seriation: {
      harm1:
        "The first harmonic, which surfaces a visual pattern that results from the node ordering following the Fiedler eigenvector, the smoothest harmonic.",
      harm2: "The next harmonics are H2 and H3 (no eponyms), each orthogonal to all previous harmonics.",
      harm3: "The next harmonics are H2 and H3 (no eponyms), each orthogonal to all previous harmonics.",
      pc1: "The first PC, which explains the most variance: the diagonal polar ends, or the extremes of the visual pattern, surface the strongest contrast between neighborhoods.",
      pc2: "Next are PC2 and PC3, which explain the next most variance, each orthogonal to the PCs before them.",
      pc3: "Next are PC2 and PC3, which explain the next most variance, each orthogonal to the PCs before them.",
    },
    censusMeasure: {
      degree: "Moves to the left polylines that start high (large degree), and those that start low right (low degree).",
      reach: "Moves to the left waves whose bulk shape arrives in a few hops, and those whose bulk occurs late right.",
      spread:
        "Moves to the left polylines whose wave shapes spread over many of their hops, and moves to the right polyline shapes that form a tight wave.",
      skew: "Moves to the left wave shapes whose bulk arrives early and trails off in a long tail, and moves to the right polylines that climb for long and end abruptly.",
    },
    ordering: {
      topdown:
        "Places each component at the mean horizontal position of its neighbors in denser shells, nearer shells counting more, so components that connect across shells line up, a layout that results from reducing edge crossings.",
      packed:
        "Packs components within a k-core shell horizontally from sparse to dense: by a component's highest onion value, then by its total onion value, then its size in number of nodes, arranged from left to right.",
    },
  },
} as const;
