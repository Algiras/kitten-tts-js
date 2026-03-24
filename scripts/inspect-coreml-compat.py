from pathlib import Path
import argparse
import onnx
from onnx import shape_inference


def read_dims(value_info):
    tensor_type = value_info.type.tensor_type
    if not tensor_type.HasField('shape'):
        return None
    dims = []
    for dim in tensor_type.shape.dim:
      if dim.HasField('dim_value'):
          dims.append(dim.dim_value)
      elif dim.HasField('dim_param'):
          dims.append(f'<{dim.dim_param}>')
      else:
          dims.append('?')
    return dims


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('model_path')
    args = parser.parse_args()

    model = onnx.load(Path(args.model_path))
    inferred = shape_inference.infer_shapes(model)

    values = {}
    initializers = {}
    consumers = {}
    for collection in (inferred.graph.input, inferred.graph.value_info, inferred.graph.output):
        for value_info in collection:
            if value_info.type.HasField('tensor_type'):
                dims = read_dims(value_info)
                if dims is not None:
                    values[value_info.name] = dims

    for initializer in model.graph.initializer:
        initializers[initializer.name] = onnx.numpy_helper.to_array(initializer).tolist()

    for index, node in enumerate(model.graph.node):
        for input_name in node.input:
            consumers.setdefault(input_name, []).append((index, node.name, node.op_type))

    print('model:', args.model_path)
    print('ir_version:', model.ir_version)
    print('opsets:', [(entry.domain or 'ai.onnx', entry.version) for entry in model.opset_import])
    print('graph_inputs:', [value.name for value in model.graph.input])
    print('graph_outputs:', [value.name for value in model.graph.output])
    print('node_count:', len(model.graph.node))

    wanted = [
        '/Slice_2_output_0',
        '/decoder/generator/m_source/l_sin_gen/Slice_output_0',
        '/Squeeze_output_0',
    ]
    print('wanted_shapes:')
    for name in wanted:
        print(f'  {name}: {values.get(name)}')

    zero_dims = [(name, dims) for name, dims in values.items() if any(dim == 0 for dim in dims)]
    print('zero_dim_tensor_count:', len(zero_dims))
    for name, dims in zero_dims[:100]:
        print(f'  {name}: {dims}')

    print('wanted_nodes:')
    wanted_set = set(wanted)
    for index, node in enumerate(model.graph.node):
        if wanted_set.intersection(node.output):
            print(f'  index={index} name={node.name!r} op={node.op_type}')
            print(f'    inputs={list(node.input)}')
            print(f'    outputs={list(node.output)}')
            for input_name in node.input:
                if input_name in values:
                    print(f'    input_shape {input_name}={values[input_name]}')
                if input_name in initializers:
                    print(f'    initializer {input_name}={initializers[input_name]}')
            for output_name in node.output:
                if output_name in consumers:
                    print(f'    consumers {output_name}={consumers[output_name][:8]}')
            if node.attribute:
                for attr in node.attribute:
                    print(f'    attr {attr.name}={onnx.helper.get_attribute_value(attr)!r}')


if __name__ == '__main__':
    main()