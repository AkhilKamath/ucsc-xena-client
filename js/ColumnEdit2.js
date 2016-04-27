/*global location: false, require: false, module: false */
'use strict';

var React = require('react');
var {Button, ButtonToolbar, Modal, Glyphicon, Nav, NavItem} = require('react-bootstrap/lib');
var CohortSelect = require('./views/CohortSelect');
var DatasetSelect = require('./views/DatasetSelect2');
var _ = require('./underscore_ext');
var uuid = require('./uuid');
require('./ColumnEdit.css');
var phenotypeEdit = require('./views/PhenotypeEdit');
var geneEdit = require('./views/GeneEdit');
var geneProbeEdit = require('./views/GeneProbeEdit');
var {PropTypes} = React;
var {getColSpec} = require('./models/datasetJoins');
var {defaultColorClass} = require('./heatmapColors');

var editors = {
	'clinicalMatrix': phenotypeEdit,
	'mutationVector': geneEdit,
	'none': {Editor: () => <span></span>, valid: () => false}
};

//var pickEditor = (m) => {
//	return _.get(editors, _.get(m, 'type', 'none'), geneProbeEdit);
//}

var pickEditor = function(datasets, chosenDs) {
	if (datasets && chosenDs){
		let dsMeta = datasets[chosenDs[0]]; // only 1 entry when dataset sub type is NOT 'phenotype'
		return _.get(editors, _.get(dsMeta, 'type', 'none'), geneProbeEdit);
	} else {
		return {Editor: null, apply: null};
	}
};

function workflowIndicators(positions, defs, onHide) {
	// Show all breadcrumbs regardless of where in the workflow the user is in.
	let count = 0,
		activeSection = _.findKey(positions, s => s),
		tabs = _.map(_.omit(defs, def => def.omit), (def, key) => {
			count++;
			let navTitle = `${count}. Select ${def.name}`;
			return (
				<NavItem className ='row' eventKey={key} key={key} disabled>
					<span>{navTitle}</span>
				</NavItem>
			);
		});

	return (
		<Modal.Header onHide={onHide} closeButton>
			<Nav bsStyle='pills' activeKey={activeSection}>{tabs}</Nav>
		</Modal.Header>
	);
}

function updateChoice(currentPosition, defs, oldChoices) {
	/*
	 1. Find specific section within defs collection.
	 2. Sections that do not represent 'prevPosition' keep their values -- are not changed
	 3. Once found, reset all 'choice' params (e.g. 'staged' and 'committed') to null.
	 */
	let comparePosition = _.getIn(defs, [currentPosition, 'next']);
	let updatedChoices = _.mapObject(oldChoices, (s, key) => {
		if (key === comparePosition) {
			comparePosition = _.getIn(defs, [comparePosition, 'next']);
			return null;
		} else {
			return s;
		}
	});

	return updatedChoices;
}

function updatePositions(newSection, oldPositions) {
	//Set new sectopm to true, and all other defs to false
	return _.mapObject(oldPositions, (value, section) => (section === newSection));
}

function makeLabel(content, label) {
	return (
		<div className='row'>
			<label className="col-md-3 text-right control-label">{label}</label>
			<div className="col-md-8 text-left">{content}</div>
		</div>
	);
}

var NavButtons = React.createClass({
	propTypes: {
		choices: PropTypes.object,
		onCancel: PropTypes.func,
		onForward: PropTypes.func,
		onPrev: PropTypes.func,
		positions: PropTypes.object
	},
	makeForwardBtn: function(currentSection) {
		/* FORWARD BTN: Select | Next | Done */
		let btnLabel,
			icon,
			{choices, onForward} = this.props,
			disabled = !choices[currentSection] || choices[currentSection].length === 0;

		if (currentSection === "cohort"){
			btnLabel = 'Select';
			icon = '';
		} else if (currentSection === "dataset"){
			btnLabel = 'Next';
			icon = "menu-right";
		} else if (currentSection === "editor"){
			btnLabel = 'Done';
			icon = '';
		}

		return (
			<Button key="FORWARD" bsStyle='primary' disabled={disabled} onClick={onForward}>
				{btnLabel} <Glyphicon glyph={icon}/>
			</Button>
		);
	},
	render: function() {
		let buttons = [],
			{defs, onBack, onCancel, positions} = this.props,
			currentSection = _.findKey(positions, (status) => status),
			prevSection = defs[currentSection].prev;

		/* PREV && CANCEL */
		if (prevSection) {
			if (!defs[prevSection].omit) {
				buttons.push(
					<Button key='BACK' onClick={onBack} bsStyle='primary'>
						<Glyphicon glyph='menu-left' /> Prev
					</Button>);
			}
			buttons.push(<Button key="CANCEL" onClick={onCancel}>Cancel</Button>);
		}
		buttons.push(this.makeForwardBtn(currentSection));
		return (
			<ButtonToolbar>{buttons}</ButtonToolbar>
		);
	}
});

var ColumnEdit = React.createClass({
	defs: {
		cohort: {
			omit: true,
			name: 'Cohort',
			next: 'dataset',
			prev: null
		},
		dataset: {
			omit: false,
			name: 'dataset',
			next: 'editor',
			prev: 'cohort'
		},
		editor: {
			omit: false,
			name: 'data slice',
			next: null,
			prev: 'dataset'
		}
	},
	getInitialState: function () {
		let {appState: {cohort}} = this.props;
		return {
			choices: {
				cohort: cohort,
				dataset: [],
				editor: null
			},
			positions: {
				cohort: cohort ? false : true,
				dataset: cohort ? true : false,
				editor: false
			}
		};
	},
	addColumn: function (settings) {
		let {callback, appState} = this.props,
			dsIDs = this.state.choices.dataset,
			dsID = _.has(settings, 'dsID') ? settings.dsID : dsIDs[0],
			ds = appState.datasets[dsID];
		settings = _.assoc(getColSpec([settings], appState.datasets),
			'width', 200, // XXX move this default setting?
			'columnLabel', {user: ds.label, default: ds.label},
			'colorClass', defaultColorClass(ds),
			'assembly', ds.assembly,
			'dsID', dsID);
		this.props.onHide();
		callback(['add-column', uuid(), settings]);
	},
	onCohortSelect: function(value) {
		this.setChoice('cohort', value);
	},
	onDatasetSelect: function (dsIDs) {
		var {callback, appState: {datasets}} = this.props,
			metas = _.pick(datasets, dsIDs);

		this.setChoice('dataset', dsIDs);

		if (_.toArray(metas).length === 1) {
			let dsID = _.first(dsIDs);
			callback(['edit-dataset', dsID, metas[dsID]]);
		}
	},
	onBack: function() {
		let {positions} = this.state,
			currentSpot = _.findKey(positions, (position) => position),
			newSpot = this.defs[currentSpot].prev;
		if (newSpot) {
			/*
			 - Exception situation where user cannot go back to 'Cohort' section
			 after it's selected.
			 - This exeption is already take care of simply by not displaying back button
			 within set of Navigation buttons
			 */
			let newPositions = updatePositions(newSpot, positions);
			this.setState({positions: newPositions});
		}
	},
	onForward: function() {
		let newState = {},
			{choices, positions} = this.state,
			currentSpot = _.findKey(positions, (position) => position),
			currentSpotDef = this.defs[currentSpot],
			nextSpot = currentSpotDef.next;

		if (this.defs[currentSpot].omit) {
			this.props.callback([currentSpot, choices[currentSpot]]);
		}

		// Set new position in workflow if necessary and reset choices
		if (nextSpot) {
			_.extendOwn(newState, {
				choices: updateChoice(currentSpot, this.defs, choices),
				positions: updatePositions(nextSpot, positions)
			});
			this.setState(newState);
		} else if (currentSpot === 'editor'){
			let {appState: {features, datasets}} = this.props,
				chosenDs = choices.dataset,
				{apply} = pickEditor(datasets, chosenDs),
				hasGenes = chosenDs && !!datasets[chosenDs[0]].probeMap;

			this.addColumn(apply(features[chosenDs[0]], choices.editor, hasGenes, datasets[chosenDs[0]]));
		}
	},
	onHub: function(){
		location.href = "../hub/";
	},
	setChoice: function(section, newValue) {
		let newState = _.assocIn(this.state, ['choices', section], newValue);
		this.setState(newState);
	},
	onSetEditor: function (newEditor) {
		var oldEditor = this.state.choices.editor || {};
		this.setChoice('editor', _.merge(oldEditor, newEditor));
	},
	render: function () {
		var {choices, positions} = this.state,
			{appState: {cohorts, columnEdit, datasets, features, servers}, callback, onHide} = this.props,
			chosenDs = choices.dataset,  // choices.dataset is an array of datasets
			{Editor} = pickEditor(datasets, chosenDs),
			chosenDsSingle = (chosenDs && chosenDs.length === 1) ? datasets[chosenDs[0]] : null,
			chosenDsSingleLink = chosenDsSingle ? "../datapages/?dataset=" + chosenDsSingle.name +
				"&host=" + JSON.parse(chosenDsSingle.dsID).host : null;

		return (
			<Modal show={true} className='columnEdit container' enforceFocus>
				{positions['cohort'] ?
					<Modal.Header onHide={onHide} closeButton>
        				<Modal.Title>Select a cohort</Modal.Title>
      				</Modal.Header> : null}

				{positions['dataset'] || positions['editor'] ?
					workflowIndicators(positions, this.defs, onHide) : null }

				<Modal.Body>
					{positions['cohort'] ?
					<CohortSelect onSelect={this.onCohortSelect} cohorts={cohorts}
						cohort={choices.cohort} makeLabel={makeLabel}/> : null}

					{positions['cohort'] ?
						<div>
							<br/>
							<span>If not found, perhaps the cohort is on a different data hub?</span>
							{' '}
							<Button onClick={this.onHub}>Configure My Data Hubs</Button>
						</div> : null}

					{positions['dataset'] ?
					<DatasetSelect datasets={datasets} makeLabel={makeLabel}
						event='dataset' value={chosenDs || null} onSelect={this.onDatasetSelect}
						servers={_.uniq(_.reduce(servers, (all, list) => all.concat(list), []))}/> : null}

					{positions['editor'] ?
						<div>{makeLabel( chosenDs.length === 1 ?
							<a href={chosenDsSingleLink} target="_BLANK">{datasets[chosenDs[0]].label}</a> : "Combined phenotypes",
							"Dataset")}</div>
						: null}
					<br/>

					{positions['editor'] ?
					<Editor {...columnEdit} allFeatures={features} callback={callback}
						{...(this.state.choices['editor'] || {})} chosenDs={chosenDs}
						hasGenes={chosenDs && !!datasets[chosenDs[0]].probeMap}
						makeLabel={makeLabel} setEditorState={this.onSetEditor}/> : null}
					<br/>

				</Modal.Body>
				<div className="form-group selection-footer">
					<span className="col-md-6 col-md-offset-3 text-center">
						<NavButtons {...this.state}
							onBack={this.onBack} onCancel={onHide} defs={this.defs}
							onForward= {this.onForward}
						/>
					</span>
				</div>
			</Modal>
		);
	}
});

module.exports = ColumnEdit;
