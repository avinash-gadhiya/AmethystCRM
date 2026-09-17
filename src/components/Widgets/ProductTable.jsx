import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

// project import
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';

// third party - Lucide icons
import { Edit2, Trash2 } from 'lucide-react';

const ACTION_ICON_MAP = {
  edit: Edit2,
  'trash-2': Trash2
};

// -----------------------|| PRODUCT TABLE ||-----------------------//

export default function ProductTable({ wrapclass, title, height, tableheading, rowdata }) {
  return (
    <div className={`card ${wrapclass || ''}`}>
      <div className="card-header">
        <h5 className="text-base font-semibold text-gray-800">{title}</h5>
      </div>
      <div className="p-0 overflow-hidden">
        <SimpleBar style={{ height }}>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  {tableheading.map((x, i) => (
                    <th key={i}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowdata.map((y, j) => (
                  <tr key={j}>
                    <td>{y.name}</td>
                    <td>{y.image}</td>
                    <td>
                      <span className={`badge ${y.status.badge === 'success' ? 'bg-success' : y.status.badge === 'danger' ? 'bg-danger' : 'bg-secondary'}`}>
                        {y.status.label}
                      </span>
                    </td>
                    <td>{y.price}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        {y.action.map((z, k) => {
                          const IconComponent = ACTION_ICON_MAP[z.icon] || Edit2;
                          return (
                            <Link
                              to={z.link}
                              key={k}
                              className={`text-${z.textcls} hover:opacity-80`}
                            >
                              <IconComponent size={16} />
                            </Link>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SimpleBar>
      </div>
    </div>
  );
}

ProductTable.propTypes = {
  wrapclass: PropTypes.string,
  title: PropTypes.string,
  height: PropTypes.string,
  tableheading: PropTypes.any,
  rowdata: PropTypes.any
};
