import { validateDimensions } from './index';
import { cloneDeep } from '../helpers';

export default function TimingEvent(dimensions, otherData = {}) {
	if (!validateDimensions(dimensions)) {
		return;
	}

	const start = Date.now();
	const data = {
		get type() {
			return 'timing';
		}
	};

	Object.assign(data, cloneDeep({ ...otherData, dimensions }));

	const event = {
		get data() {
			return cloneDeep(data);
		},
		close(otherData = {}) {
			const elapsed = Date.now() - start;
			Object.assign(data, cloneDeep({ ...otherData, elapsed }));
			return event;
		}
	};

	return event;
}
